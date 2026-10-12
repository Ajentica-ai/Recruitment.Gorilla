using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

/// <summary>
/// Imports candidates described in a JSON file, each with its CV, as Pending drafts for review.
/// Admin and Super Admin only. The client reads the JSON file and sends one entry and its CV per request,
/// the same way the CV upload sends one file per request, so a large batch never becomes one huge request.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.AdminOrAbove)]
[Route("api/candidate-import")]
public class CandidateImportController(
    CandidateImportService importService,
    CandidateDraftService draftService,
    CvFileIntake intake,
    ICVUploadProgressNotifier progressNotifier,
    CurrentUser currentUser,
    ILogger<CandidateImportController> logger) : ControllerBase
{
    public const string TemplateFileName = "candidate-import-template.json";

    /// <summary>The JSON template, with fill-in instructions and today's role and source names in its comments.</summary>
    [HttpGet("template")]
    public async Task<IActionResult> Template()
    {
        var text = await importService.BuildTemplateAsync();
        return File(Encoding.UTF8.GetBytes(text), "application/json", TemplateFileName);
    }

    [HttpPost]
    public async Task<IActionResult> Import(
        [FromForm] string? entry,
        IFormFile? file,
        [FromForm] string? batchId = null,
        [FromForm] string? batchName = null,
        [FromForm] int? fileIndex = null,
        [FromForm] int? totalFiles = null,
        [FromForm] int? roleAppliedOptionId = null)
    {
        var bId = batchId ?? Guid.NewGuid().ToString("N");
        var idx = fileIndex ?? 0;
        var total = totalFiles ?? 1;
        var fileName = file?.FileName ?? "unknown";

        async Task<IActionResult> Reject(int status, string message)
        {
            logger.LogWarning("Rejected JSON import of '{FileName}': {Reason}", fileName, message);
            await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
                bId, idx, total, fileName, "error", 0, null, message));
            return StatusCode(status, message);
        }

        // The draft's BatchId and BatchName columns; longer would be a database failure, not a readable 400.
        if (bId.Length > 100 || batchName?.Length > 200)
            return await Reject(StatusCodes.Status400BadRequest, "The batch id or batch label is too long.");

        if (await draftService.ValidateJobOpeningForCallerAsync(roleAppliedOptionId, required: true) is string roleError)
            return await Reject(StatusCodes.Status400BadRequest, roleError);

        var (parsed, parseError) = CandidateImportService.ParseEntry(entry);
        if (parsed is null) return await Reject(StatusCodes.Status400BadRequest, parseError!);

        var invalidFile = CvFileIntake.Validate(file);
        if (invalidFile is not null) return await Reject(StatusCodes.Status400BadRequest, invalidFile);

        if (!string.Equals(parsed.CvFileName, file!.FileName, StringComparison.OrdinalIgnoreCase))
            return await Reject(StatusCodes.Status400BadRequest,
                $"cvFileName '{CandidateImportService.Shorten(parsed.CvFileName)}' does not match the uploaded file '{CandidateImportService.Shorten(file.FileName)}'.");

        var validation = await importService.ValidateAsync(parsed, roleAppliedOptionId);
        if (validation.Errors.Count > 0)
            return await Reject(StatusCodes.Status400BadRequest, string.Join(" ", validation.Errors));

        var (hash, duplicateError) = await intake.CheckDuplicateAsync(file);
        if (duplicateError is not null) return await Reject(StatusCodes.Status409Conflict, duplicateError);

        await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
            bId, idx, total, file.FileName, "parsing", 30, null, null));

        var stored = await intake.SaveAsync(file, hash);
        CVDraftDto draft;
        try
        {
            draft = await importService.CreateDraftAsync(parsed, validation, stored, bId, batchName);
        }
        catch
        {
            // No draft owns the file, so nothing would ever clean it up.
            intake.Delete(stored.StoredFileName);
            throw;
        }

        logger.LogInformation(
            "Imported JSON entry for '{FileName}' as Draft #{DraftId} stored as {StoredName}.",
            file.FileName, draft.Id, stored.StoredFileName);

        await progressNotifier.NotifyProgressAsync(currentUser.UserId?.ToString(), bId, new CVUploadProgressEvent(
            bId, idx, total, file.FileName, "completed", 100, draft, null));

        return Ok(new ImportCandidateResultDto(draft, validation.Warnings));
    }
}
