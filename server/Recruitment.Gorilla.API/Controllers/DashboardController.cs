using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController(DashboardService dashboardService, CurrentUser currentUser) : ControllerBase
{
    // Owner scope for the candidate-centric sections only: Admin+ see all; a Recruiter is
    // limited to their own. (The org-wide endpoints below are deliberately unscoped.)
    private int? ReadOwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    // ---- Org-wide figures — visible to every authenticated role, no owner scope ----

    [HttpGet("kpis")]
    public async Task<IActionResult> GetKpis() => Ok(await dashboardService.GetKpisAsync());

    [HttpGet("status-breakdown")]
    public async Task<IActionResult> GetStatusBreakdown() =>
        Ok(await dashboardService.GetStatusBreakdownAsync());

    [HttpGet("applications-trend")]
    public async Task<IActionResult> GetApplicationsTrend([FromQuery] int days = 30) =>
        Ok(await dashboardService.GetApplicationsTrendAsync(days));

    [HttpGet("applications-summary")]
    public async Task<IActionResult> GetApplicationsSummary([FromQuery] int days = 30) =>
        Ok(await dashboardService.GetApplicationsSummaryAsync(days));

    [HttpGet("job-openings")]
    public async Task<IActionResult> GetJobOpenings() =>
        Ok(await dashboardService.GetJobOpeningsAsync());

    // ---- Owner-scoped remainder (by-role / top-skills / upcoming / activity) ----

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? roleId) =>
        Ok(await dashboardService.GetScopedAsync(ReadOwnerScope, roleId));
}
