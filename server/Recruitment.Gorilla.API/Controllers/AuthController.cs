using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AuthService auth,
    AuditService audit,
    CurrentUser currentUser,
    IWebHostEnvironment env,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string RefreshCookie = "rg_refresh";

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var check = await auth.CheckLoginAsync(dto.Email.Trim(), dto.Password);
        if (check.Status == LoginStatus.AccountInactive)
        {
            logger.LogWarning("Login refused for inactive account '{Email}'.", dto.Email);
            await audit.RecordAsync("Auth.LoginFailed", actorUserId: null, actorName: dto.Email,
                summary: $"Login refused for inactive account '{dto.Email}'");
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "account_inactive",
                message = "Your account is inactive. Please contact your administrator.",
            });
        }

        var user = check.User;
        if (user is null)
        {
            logger.LogWarning("Failed login attempt for '{Email}'.", dto.Email);
            await audit.RecordAsync("Auth.LoginFailed", actorUserId: null, actorName: dto.Email,
                summary: $"Failed login for '{dto.Email}'");
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var pair = await auth.CreateTokenPairAsync(user);
        SetRefreshCookie(pair.RefreshToken, pair.RefreshExpiresAt);

        logger.LogInformation("User '{Email}' logged in.", user.Email);
        await audit.RecordAsync("Auth.Login", user.Id, user.Name, "User", user.Id, $"'{user.Email}' logged in");
        return Ok(ToResult(pair));
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var raw = Request.Cookies[RefreshCookie];
        if (string.IsNullOrEmpty(raw))
            return Unauthorized(new { message = "No refresh token." });

        var pair = await auth.RefreshAsync(raw);
        if (pair is null)
        {
            DeleteRefreshCookie();
            return Unauthorized(new { message = "Invalid or expired refresh token." });
        }

        SetRefreshCookie(pair.RefreshToken, pair.RefreshExpiresAt);
        return Ok(ToResult(pair));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var raw = Request.Cookies[RefreshCookie];
        if (!string.IsNullOrEmpty(raw))
            await auth.RevokeAsync(raw);

        DeleteRefreshCookie();
        return NoContent();
    }

    /// <summary>
    /// Self-service password change. Reachable while a forced password change is pending
    /// (see <see cref="Authorization.PasswordChangedRequirement"/>); requires authentication.
    /// </summary>
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        if (currentUser.UserId is not int userId)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 8)
            return BadRequest(new { message = "New password must be at least 8 characters." });

        var result = await auth.ChangePasswordAsync(userId, dto.CurrentPassword, dto.NewPassword);
        if (result == AuthService.ChangePasswordResult.Success)
            await audit.RecordAsync("Auth.PasswordChanged", "User", userId, "Changed own password");
        return result switch
        {
            AuthService.ChangePasswordResult.Success => NoContent(),
            AuthService.ChangePasswordResult.WrongCurrentPassword =>
                BadRequest(new { message = "Current password is incorrect." }),
            _ => Unauthorized(),
        };
    }

    private static AuthResultDto ToResult(TokenPair pair) => new(
        pair.AccessToken,
        pair.User.Name,
        pair.User.Email,
        pair.User.Roles.Select(r => r.Role).ToArray(),
        pair.User.MustChangePassword,
        pair.AccessExpiresAt);

    private void SetRefreshCookie(string token, DateTime expiresAt) =>
        Response.Cookies.Append(RefreshCookie, token, BuildCookieOptions(expiresAt));

    private void DeleteRefreshCookie() =>
        Response.Cookies.Append(RefreshCookie, "", BuildCookieOptions(DateTime.UtcNow.AddDays(-1)));

    private CookieOptions BuildCookieOptions(DateTime expiresAt) => new()
    {
        HttpOnly = true,
        // Secure requires HTTPS; disabled in Development where the dev server is http.
        Secure = !env.IsDevelopment(),
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        Expires = expiresAt,
    };
}
