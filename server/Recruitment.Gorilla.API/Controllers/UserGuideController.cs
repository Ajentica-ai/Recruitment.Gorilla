using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api/user-guide")]
public class UserGuideController(UserGuideService userGuide, CurrentUser currentUser) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(userGuide.Get(currentUser.Roles));
}
