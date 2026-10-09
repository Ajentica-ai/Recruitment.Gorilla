using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api/status-options")]
public class StatusOptionsController(StatusOptionService statusOptionService, CurrentUser currentUser) : ControllerBase
{
    // Admin+ reach any candidate; a Recruiter only one they own or are an assigned recruiter
    // for (CandidateService.ApplyAccess). Matches CandidatesController.ReadOwnerScope.
    private int? ReadOwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    [HttpGet]
    public async Task<IActionResult> GetActive()
    {
        var statuses = await statusOptionService.GetActiveAsync();
        return Ok(statuses);
    }

    [HttpGet("initial")]
    public async Task<IActionResult> GetInitial()
    {
        var statuses = await statusOptionService.GetInitialAsync();
        return Ok(statuses);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("next/{candidateId:int}")]
    public async Task<IActionResult> GetNext(int candidateId)
    {
        var statuses = await statusOptionService.GetNextForCandidateAsync(candidateId, ReadOwnerScope);
        return statuses is null ? NotFound() : Ok(statuses);
    }
}
