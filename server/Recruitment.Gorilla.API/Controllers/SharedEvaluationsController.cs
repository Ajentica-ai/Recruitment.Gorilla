using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

/// <summary>
/// What a grantee can read of the evaluations shared with them (#182, phase 2). Any authenticated
/// role may call these: access comes only from an active grant, decided by the single
/// <see cref="EvaluationAccess"/> predicate, never from the caller's role or candidate scope. A
/// caller without a grant gets 404, so the endpoints do not reveal which candidates exist. The
/// existing evaluation-report and interview endpoints are not widened by any of this.
/// </summary>
[ApiController]
[Authorize]
[Route("api/shared-evaluations")]
public class SharedEvaluationsController(
    EvaluationAccess access,
    InterviewService interviews,
    CandidateService candidates,
    CurrentUser currentUser) : ControllerBase
{
    /// <summary>Candidates shared with the caller. Revoked and expired grants are excluded.</summary>
    [HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        return Ok(await access.SharedWithMeAsync(userId));
    }

    /// <summary>
    /// The candidate's evaluation report limited to the interviews the predicate allows, so the
    /// averages and recommendation tally cover only what the caller may see. Submitted evaluations
    /// only. 404 when nothing is visible.
    /// </summary>
    [HttpGet("candidates/{candidateId:int}")]
    public async Task<IActionResult> Report(int candidateId)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();

        var visible = await access.VisibleInterviewIdsAsync(userId, candidateId);
        if (visible.Count == 0) return NotFound();

        // Scope null: access was decided by the grant above, not by candidate ownership.
        var report = await interviews.GetCandidateEvaluationReportAsync(candidateId, ownerScope: null, visible);
        return report is null ? NotFound() : Ok(report);
    }

    /// <summary>
    /// The read-only candidate snapshot an assigned interviewer gets: no status history, because
    /// its comments and per-round evaluation summaries would reach past what was shared.
    /// </summary>
    [HttpGet("candidates/{candidateId:int}/profile")]
    public async Task<IActionResult> Profile(int candidateId)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        if (!await access.HasActiveGrantAsync(userId, candidateId)) return NotFound();

        var candidate = await candidates.GetByIdAsync(candidateId);
        return candidate is null ? NotFound() : Ok(candidate with { StatusHistory = [] });
    }

    /// <summary>The candidate's CV, behind the same grant check as the profile.</summary>
    [HttpGet("candidates/{candidateId:int}/cv/{fileId:int}")]
    public async Task<IActionResult> CvFile(int candidateId, int fileId)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        if (!await access.HasActiveGrantAsync(userId, candidateId)) return NotFound();

        var file = await candidates.GetCvFileAsync(candidateId, fileId);
        return file is null
            ? NotFound()
            : PhysicalFile(file.PhysicalPath, file.ContentType, file.OriginalFileName);
    }
}
