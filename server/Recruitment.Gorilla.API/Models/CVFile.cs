namespace Recruitment.Gorilla.API.Models;

public class CVFile
{
    public int Id { get; set; }
    public int CandidateId { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    /// <summary>SHA-256 of the file content (hex). Used to block re-uploading the same CV.</summary>
    public string? FileHash { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public Candidate Candidate { get; set; } = null!;
}
