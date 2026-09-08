using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.CanWriteCandidate)]
[Route("api/cvupload")]
public class CVUploadController(
    CVParserService parser,
    CandidateDraftService draftService,
    IWebHostEnvironment env,
    ICVUploadProgressNotifier progressNotifier,
    CurrentUser currentUser,
    ILogger<CVUploadController> logger) : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = [".pdf", ".docx"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    [HttpPost]
    public async Task<IActionResult> Upload(
        IFormFile file,
        [FromForm] string? batchId = null,
        [FromForm] string? batchName = null,
        [FromForm] int? fileIndex = null,
        [FromForm] int? totalFiles = null,
        [FromForm] int? roleAppliedOptionId = null)
    {
        var bId = batchId ?? Guid.NewGuid().ToString("N");
        var idx = fileIndex ?? 0;
        var total = totalFiles ?? 1;

        if (file is null || file.Length == 0)
        {
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, "unknown", "error", 0, null, "No file provided."));
            return BadRequest("No file provided.");
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            logger.LogWarning("Rejected upload '{FileName}': unsupported extension {Ext}.", file.FileName, ext);
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, file.FileName, "error", 0, null, "Only PDF and Word (.docx) files are accepted."));
            return BadRequest("Only PDF and Word (.docx) files are accepted.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            logger.LogWarning("Rejected upload '{FileName}': size {Size} exceeds limit.", file.FileName, file.Length);
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, file.FileName, "error", 0, null, "File exceeds the 10 MB size limit."));
            return BadRequest("File exceeds the 10 MB size limit.");
        }

        // Notify client parsing has started
        await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
            bId, idx, total, file.FileName, "parsing", 30, null, null));

        var fileType = ext == ".pdf" ? "PDF" : "Word";
        var storedName = $"{Guid.NewGuid()}{ext}";
        var uploadsPath = Path.Combine(env.ContentRootPath, "Uploads");
        Directory.CreateDirectory(uploadsPath);
        var fullPath = Path.Combine(uploadsPath, storedName);

        using (var stream = System.IO.File.Create(fullPath))
            await file.CopyToAsync(stream);

        var parsed = parser.Parse(fullPath, fileType);
        var name = parsed.Name;

        var (fallbackName, fallbackTitle) = CVParserService.ParseNameAndTitleFromFileName(file.FileName);
        if (string.IsNullOrWhiteSpace(name)) name = fallbackName;

        // Persist draft to MySQL database for long-term review
        var draftEntity = await draftService.CreateDraftAsync(
            file.FileName, storedName, fileType, file.Length,
            bId, batchName, name, parsed.Email, parsed.Phone, parsed.LinkedIn, parsed.Github, parsed.Skills, parsed.Summary,
            parsed.Location, parsed.LeetCode, parsed.Codeforces, parsed.HackerRank, parsed.GitLab,
            parsed.Educations, parsed.Experiences,
            roleAppliedOptionId: roleAppliedOptionId);

        var eduDtos = parsed.Educations.Select((e, i) => new CandidateEducationDto(i + 1, e.Degree, e.Institution, e.GraduationYear, e.Cgpa)).ToList();
        var expDtos = parsed.Experiences.Select((e, i) => new CandidateExperienceDto(i + 1, e.JobTitle, e.Company, e.Duration, e.Description)).ToList();

        if (draftEntity.CurrentTitle == null && fallbackTitle != null)
        {
            draftEntity.CurrentTitle = fallbackTitle;
            await draftService.UpdateDraftAsync(draftEntity.Id, new UpdateCandidateDraftDto(
                draftEntity.FullName, draftEntity.Email, draftEntity.Phone, fallbackTitle,
                draftEntity.RelevantExperience, draftEntity.Skills, draftEntity.Summary,
                draftEntity.LinkedInUrl, draftEntity.GithubUrl, draftEntity.PortfolioUrl,
                draftEntity.RoleAppliedOptionId, draftEntity.SourceOptionId, draftEntity.SourceDetail,
                draftEntity.Location, draftEntity.LeetCodeUrl, draftEntity.CodeforcesUrl, draftEntity.HackerRankUrl, draftEntity.GitLabUrl,
                eduDtos, expDtos));
        }

        var draft = new CVDraftDto(
            name, parsed.Email, parsed.Phone, fallbackTitle, parsed.Skills, parsed.Summary, parsed.LinkedIn, parsed.Github,
            file.FileName, storedName, fileType, file.Length,
            draftEntity.Id, bId, batchName,
            parsed.Location, parsed.LeetCode, parsed.Codeforces, parsed.HackerRank, parsed.GitLab,
            eduDtos, expDtos);

        logger.LogInformation(
            "Parsed & persisted CV '{FileName}' ({FileType}, {Size} bytes) as Draft #{DraftId} stored as {StoredName}.",
            file.FileName, fileType, file.Length, draftEntity.Id, storedName);

        // Broadcast successful extraction via SignalR
        await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
            bId, idx, total, file.FileName, "completed", 100, draft, null));

        return Ok(draft);
    }
}
