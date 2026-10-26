using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api/interviews")]
public class InterviewsController(
    InterviewService interviews,
    ConfigurationService config,
    AuditService audit,
    CurrentUser currentUser,
    ILogger<InterviewsController> logger) : ControllerBase
{
    private bool IsAdmin => currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin);

    // Admin+ act on any candidate's interview; a Recruiter is limited to candidates they own or
    // are the assigned recruiter for (enforced by CandidateService's access predicate).
    private int? OwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    /// <summary>Active users that can be assigned as interviewers.</summary>
    [HttpGet("assignable-users")]
    public async Task<IActionResult> GetAssignableUsers() =>
        Ok(await interviews.GetAssignableUsersAsync());

    /// <summary>Active interview type tags for the schedule form (readable by any authorized user).</summary>
    [HttpGet("types")]
    public async Task<IActionResult> GetInterviewTypes() =>
        Ok(await config.GetActiveInterviewTypesAsync());

    /// <summary>Interviews the current user is assigned to.</summary>
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        return Ok(await interviews.GetMineAsync(userId));
    }

    /// <summary>
    /// The "My interviews" page (#203): the caller's own assigned interviews, one tab at a time (upcoming, awaiting,
    /// submitted, cancelled), searchable by candidate name and paged. Any signed-in role; it only ever reads the
    /// caller's own assignments and evaluation.
    /// </summary>
    [HttpGet("mine/history")]
    public async Task<IActionResult> GetMineHistory(
        [FromQuery] string? tab, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        return Ok(await interviews.GetMineHistoryAsync(userId, tab, search, page, pageSize));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();
        var detail = await interviews.GetDetailAsync(id, userId, IsAdmin);
        return detail is null ? NotFound() : Ok(detail);
    }

    /// <summary>
    /// Prefill for the reschedule form. A separate, owner-scoped read model rather than widening
    /// <c>GetById</c>, which is gated on being an assigned interviewer or Admin+ and so 404s the
    /// recruiter who owns the candidate (issue #116 settled those privacy rules).
    /// </summary>
    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("{id:int}/schedule")]
    public async Task<IActionResult> GetSchedule(int id)
    {
        if (currentUser.UserId is null) return Unauthorized();

        var (result, _, notFound, _) = await interviews.GetScheduleAsync(id, OwnerScope);
        return notFound ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Moves a booking: time, duration, interviewers, types and notes. PUT rather than PATCH
    /// because the body fully replaces the schedulable fields, matching the offers endpoint.
    /// </summary>
    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Reschedule(int id, [FromBody] RescheduleInterviewDto dto)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();

        var (result, error, notFound, conflict) = await interviews.RescheduleAsync(
            id, dto, OwnerScope, userId, currentUser.Name ?? string.Empty);
        if (notFound) return NotFound();
        if (conflict) return Conflict(new { message = error });
        if (error is not null) return BadRequest(new { message = error });

        logger.LogInformation("User {UserId} rescheduled interview {InterviewId}.", userId, id);
        return Ok(result);
    }

    /// <summary>Cancels a booking and returns the candidate to Call for Interview.</summary>
    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelInterviewDto dto)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();

        var (result, error, notFound, conflict) = await interviews.CancelAsync(
            id, dto.Reason, OwnerScope, userId, currentUser.Name ?? string.Empty);
        if (notFound) return NotFound();
        if (conflict) return Conflict(new { message = error });
        if (error is not null) return BadRequest(new { message = error });

        logger.LogInformation("User {UserId} cancelled interview {InterviewId}.", userId, id);
        return Ok(result);
    }

    [HttpPut("{id:int}/evaluation")]
    public async Task<IActionResult> SaveEvaluation(int id, [FromBody] UpsertEvaluationDto dto)
    {
        if (currentUser.UserId is not int userId) return Unauthorized();

        var (result, error, notFound, conflict) = await interviews.UpsertEvaluationAsync(id, userId, dto);
        if (notFound) return NotFound();
        if (conflict) return Conflict(new { message = error });
        if (error is not null) return BadRequest(new { message = error });

        logger.LogInformation("User {UserId} {Action} evaluation for interview {InterviewId}.",
            userId, dto.Submit ? "submitted" : "saved", id);
        if (dto.Submit)
            await audit.RecordAsync("Interview.EvaluationSubmitted", "Interview", id,
                $"Submitted evaluation for interview #{id}");
        return Ok(result);
    }
}
