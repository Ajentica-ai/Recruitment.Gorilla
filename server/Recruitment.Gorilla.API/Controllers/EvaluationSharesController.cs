using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

/// <summary>
/// Share a candidate's submitted interview evaluations with a named user (#182, phase 1). The grantor
/// side only: Admin+ for any candidate, a Recruiter only for candidates in their scope. Grantees cannot
/// re-share (the gate excludes Interviewers) and nothing reads a grant yet.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.CanWriteCandidate)]
[Route("api/candidates/{candidateId:int}/evaluation-shares")]
public class EvaluationSharesController(
    EvaluationShareService shares,
    CandidateService candidates,
    CurrentUser currentUser,
    ILogger<EvaluationSharesController> logger) : ControllerBase
{
    // Same scope as the candidate endpoints: Admin+ see every candidate, a Recruiter only their own or
    // those under a job opening they are assigned to.
    private int? ReadOwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    /// <summary>404, not 403, for a candidate outside the caller's scope, like the rest of the API.</summary>
    private async Task<bool> CanSeeCandidateAsync(int candidateId) =>
        await candidates.GetByIdAsync(candidateId, ReadOwnerScope) is not null;

    [HttpGet]
    public async Task<IActionResult> List(int candidateId)
    {
        if (!await CanSeeCandidateAsync(candidateId)) return NotFound();
        return Ok(await shares.ListAsync(candidateId));
    }

    [HttpPost]
    public async Task<IActionResult> Create(int candidateId, [FromBody] CreateEvaluationSharesDto dto)
    {
        if (currentUser.UserId is not int actorId) return Unauthorized();
        if (!await CanSeeCandidateAsync(candidateId)) return NotFound();

        var (result, error) = await shares.CreateAsync(candidateId, dto, actorId, currentUser.Name);
        if (result is null) return BadRequest(error);

        logger.LogInformation(
            "{ActorId} shared evaluations of candidate {CandidateId}: {Granted} granted, {Skipped} skipped.",
            currentUser.UserId, candidateId, result.Shares.Count, result.Skipped.Count);
        return Ok(result);
    }

    [HttpDelete("{shareId:int}")]
    public async Task<IActionResult> Revoke(int candidateId, int shareId)
    {
        if (currentUser.UserId is not int actorId) return Unauthorized();
        if (!await CanSeeCandidateAsync(candidateId)) return NotFound();

        var outcome = await shares.RevokeAsync(candidateId, shareId, actorId, currentUser.Name);
        return outcome == RevokeShareResult.NotFound ? NotFound() : NoContent();
    }
}
