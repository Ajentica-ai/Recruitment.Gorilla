using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.CanWriteCandidate)]
[Route("api/analytics")]
public class AnalyticsController(AnalyticsService analyticsService, CurrentUser currentUser) : ControllerBase
{
    private int? OwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    [HttpGet]
    public async Task<IActionResult> GetSummary([FromQuery] AnalyticsFilterQuery query)
    {
        var result = await analyticsService.GetSummaryAsync(query, OwnerScope);
        return Ok(result);
    }
}
