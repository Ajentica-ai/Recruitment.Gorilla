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
    CvFileIntake intake,
    IWebHostEnvironment env,
    ICVUploadProgressNotifier progressNotifier,
    CurrentUser currentUser,
    ILogger<CVUploadController> logger) : ControllerBase
{
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

        var invalid = CvFileIntake.Validate(file);
        if (invalid is not null)
        {
            logger.LogWarning("Rejected upload '{FileName}': {Reason}", file?.FileName, invalid);
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, file?.FileName ?? "unknown", "error", 0, null, invalid));
            return BadRequest(invalid);
        }

        var (fileHash, duplicateError) = await intake.CheckDuplicateAsync(file);
        if (duplicateError is not null)
        {
            logger.LogWarning("Rejected upload '{FileName}': duplicate of an already uploaded CV.", file.FileName);
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, file.FileName, "error", 0, null, duplicateError));
            return Conflict(duplicateError);
        }

        // Notify client parsing has started
        await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
            bId, idx, total, file.FileName, "parsing", 30, null, null));

        var stored = await intake.SaveAsync(file, fileHash);
        var (storedName, fileType) = (stored.StoredFileName, stored.FileType);
        var fullPath = UploadPaths.Resolve(env.ContentRootPath, storedName)!;

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
            roleAppliedOptionId: roleAppliedOptionId,
            fileHash: fileHash);

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
