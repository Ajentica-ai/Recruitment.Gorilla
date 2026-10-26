namespace Recruitment.Gorilla.API.DTOs;

public record LoginDto(string Email, string Password);

/// <summary>
/// Access token returned in the response body; the refresh token rides in an httpOnly
/// cookie. Roles and the must-change-password flag let the client gate its UI.
/// </summary>
public record AuthResultDto(
    string Token,
    int UserId,
    string Name,
    string Email,
    string[] Roles,
    bool MustChangePassword,
    DateTime ExpiresAt);

public record ChangePasswordDto(string CurrentPassword, string NewPassword);
