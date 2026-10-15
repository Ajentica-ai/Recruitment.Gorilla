using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public record TokenPair(
    string AccessToken,
    DateTime AccessExpiresAt,
    string RefreshToken,
    DateTime RefreshExpiresAt,
    User User);

public enum LoginStatus { Success, InvalidCredentials, AccountInactive }

/// <summary><see cref="User"/> is set only for <see cref="LoginStatus.Success"/>.</summary>
public record LoginCheck(LoginStatus Status, User? User);

public class AuthService(AppDbContext db, IConfiguration config, EmailService emailService)
{
    private int AccessTokenMinutes => config.GetValue("Jwt:AccessTokenMinutes", 15);
    private int RefreshTokenDays => config.GetValue("Jwt:RefreshTokenDays", 7);

    // ----- Credentials -----

    /// <summary>Returns the user when the email matches an active account with the given password; otherwise null.</summary>
    public async Task<User?> VerifyCredentialsAsync(string email, string password) =>
        (await CheckLoginAsync(email, password)).User;

    /// <summary>
    /// Checks a login attempt. The password is verified BEFORE the active flag, so an inactive account is
    /// reported as such only to someone who already holds its correct password. A wrong password, or an
    /// unknown email, is always <see cref="LoginStatus.InvalidCredentials"/>, which keeps the message from
    /// revealing which emails exist or have been deactivated.
    /// </summary>
    public async Task<LoginCheck> CheckLoginAsync(string email, string password)
    {
        var user = await db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
            return new LoginCheck(LoginStatus.InvalidCredentials, null);

        return user.IsActive
            ? new LoginCheck(LoginStatus.Success, user)
            : new LoginCheck(LoginStatus.AccountInactive, null);
    }

    // ----- Token issuance -----

    public async Task<TokenPair> CreateTokenPairAsync(User user)
    {
        user.LastLoginAt = DateTime.UtcNow;
        var (accessToken, accessExpires) = CreateAccessToken(user);
        var (rawRefresh, refreshExpires) = await IssueRefreshTokenAsync(user);
        return new TokenPair(accessToken, accessExpires, rawRefresh, refreshExpires, user);
    }

    private (string Token, DateTime ExpiresAt) CreateAccessToken(User user)
    {
        var key = config["Jwt:Key"]!;
        var expiresAt = DateTime.UtcNow.AddMinutes(AccessTokenMinutes);
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
        };
        claims.AddRange(user.Roles.Select(r => new Claim(ClaimTypes.Role, r.Role)));
        if (user.MustChangePassword)
            claims.Add(new Claim("must_change_password", "true"));

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    private async Task<(string RawToken, DateTime ExpiresAt)> IssueRefreshTokenAsync(User user)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var expiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays);

        db.RefreshTokens.Add(new RefreshToken
        {
            TokenHash = HashToken(raw),
            Username = user.Id.ToString(),
            ExpiresAt = expiresAt,
        });
        await db.SaveChangesAsync();

        return (raw, expiresAt);
    }

    // ----- Rotation / revocation -----

    /// <summary>
    /// Validates and rotates a refresh token, rebuilding the access token from the user's
    /// current roles and active state. Returns a new pair, or null if invalid/inactive.
    /// </summary>
    public async Task<TokenPair?> RefreshAsync(string rawRefreshToken)
    {
        var hash = HashToken(rawRefreshToken);
        var existing = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (existing is null || !existing.IsActive)
            return null;

        // Re-load the user so role changes / deactivation take effect on the next refresh.
        User? user = null;
        if (int.TryParse(existing.Username, out var userId))
            user = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null || !user.IsActive)
        {
            existing.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return null;
        }

        var (newRaw, refreshExpires) = await RotateAsync(existing, user);
        var (accessToken, accessExpires) = CreateAccessToken(user);

        return new TokenPair(accessToken, accessExpires, newRaw, refreshExpires, user);
    }

    private async Task<(string RawToken, DateTime ExpiresAt)> RotateAsync(RefreshToken current, User user)
    {
        var newRaw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var newHash = HashToken(newRaw);
        var expiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays);

        current.RevokedAt = DateTime.UtcNow;
        current.ReplacedByTokenHash = newHash;

        db.RefreshTokens.Add(new RefreshToken
        {
            TokenHash = newHash,
            Username = user.Id.ToString(),
            ExpiresAt = expiresAt,
        });
        await db.SaveChangesAsync();

        return (newRaw, expiresAt);
    }

    public async Task RevokeAsync(string rawRefreshToken)
    {
        var hash = HashToken(rawRefreshToken);
        var existing = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (existing is { RevokedAt: null })
        {
            existing.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    // ----- Password change (self-service) -----

    public enum ChangePasswordResult { Success, UserNotFound, WrongCurrentPassword }

    public async Task<ChangePasswordResult> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return ChangePasswordResult.UserNotFound;

        if (!PasswordHasher.Verify(currentPassword, user.PasswordHash))
            return ChangePasswordResult.WrongCurrentPassword;

        user.PasswordHash = PasswordHasher.Hash(newPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var (subject, html) = EmailTemplates.PasswordChanged(user.Name);
        await emailService.SendAsync(user.Email, user.Name, subject, html);

        return ChangePasswordResult.Success;
    }

    private static string HashToken(string raw) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
}
