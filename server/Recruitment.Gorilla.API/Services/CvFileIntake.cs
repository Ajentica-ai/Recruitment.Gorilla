namespace Recruitment.Gorilla.API.Services;

/// <summary>A CV that has passed the intake checks and been written to the uploads folder.</summary>
public record StoredCvFile(string OriginalFileName, string StoredFileName, string FileType, long FileSizeBytes, string FileHash);

/// <summary>
/// The checks and storage every uploaded CV goes through, shared by the CV upload and the JSON import:
/// a .pdf or .docx of at most 10 MB, not already in a Pending draft or on a candidate, saved under a
/// server-issued name. The steps are separate so each endpoint can report progress between them.
/// </summary>
public class CvFileIntake(CandidateDraftService draftService, IWebHostEnvironment env)
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase) { ".pdf", ".docx" };
    public const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    /// <summary>Why this file can't be accepted (a 400), or null when its type and size are fine.</summary>
    public static string? Validate(IFormFile? file)
    {
        if (file is null || file.Length == 0) return "No file provided.";
        if (!AllowedExtensions.Contains(Path.GetExtension(file.FileName)))
            return "Only PDF and Word (.docx) files are accepted.";
        if (file.Length > MaxFileSizeBytes) return "File exceeds the 10 MB size limit.";
        if (!HasExpectedSignature(file)) return "The file's content is not a PDF or Word (.docx) document.";
        return null;
    }

    // A PDF starts with "%PDF-"; a .docx is a zip archive, which starts with "PK\x03\x04". This catches a
    // renamed file cheaply. It is not a full format check: the parser, or the reviewer, still is.
    private static readonly byte[] PdfSignature = "%PDF-"u8.ToArray();
    private static readonly byte[] ZipSignature = [0x50, 0x4B, 0x03, 0x04];

    private static bool HasExpectedSignature(IFormFile file)
    {
        var expected = Path.GetExtension(file.FileName).Equals(".pdf", StringComparison.OrdinalIgnoreCase)
            ? PdfSignature
            : ZipSignature;
        var head = new byte[expected.Length];
        using var stream = file.OpenReadStream();
        return stream.ReadAtLeast(head, head.Length, throwOnEndOfStream: false) == head.Length
            && head.AsSpan().SequenceEqual(expected);
    }

    /// <summary>The content hash, and why the CV is a duplicate (a 409) or null when it is new.</summary>
    public async Task<(string Hash, string? DuplicateError)> CheckDuplicateAsync(IFormFile file)
    {
        string hash;
        using (var stream = file.OpenReadStream())
            hash = CandidateDraftService.ComputeFileHash(stream);
        return (hash, await draftService.FindDuplicateUploadAsync(hash, file.Length));
    }

    /// <summary>Writes the file to the uploads folder as <c>{Guid}{ext}</c>.</summary>
    public async Task<StoredCvFile> SaveAsync(IFormFile file, string hash)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storedName = $"{Guid.NewGuid()}{ext}";
        var uploadsPath = Path.Combine(env.ContentRootPath, UploadPaths.FolderName);
        Directory.CreateDirectory(uploadsPath);

        try
        {
            using var stream = File.Create(Path.Combine(uploadsPath, storedName));
            await file.CopyToAsync(stream);
        }
        catch
        {
            // A partial file with no draft would never be cleaned up.
            Delete(storedName);
            throw;
        }

        return new StoredCvFile(file.FileName, storedName, ext == ".pdf" ? "PDF" : "Word", file.Length, hash);
    }

    /// <summary>Removes a stored file again, for when the draft that should own it could not be saved.</summary>
    public void Delete(string storedFileName)
    {
        var path = UploadPaths.Resolve(env.ContentRootPath, storedFileName);
        if (path is not null && File.Exists(path)) File.Delete(path);
    }
}
