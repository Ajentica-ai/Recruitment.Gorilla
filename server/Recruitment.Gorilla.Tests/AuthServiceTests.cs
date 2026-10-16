using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>AuthService: credential verification, JWT issuance, refresh rotation/revocation, change-password.</summary>
public class AuthServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private AuthService Auth()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "rg-auth-test-signing-key-32bytes-minimum!!",
                ["Jwt:Issuer"] = "i",
                ["Jwt:Audience"] = "a",
            }).Build();
        return new AuthService(Db, config, TestEmail());
    }

    private User SeedUser(string password, string role = "Recruiter", bool active = true)
    {
        var user = new User
        {
            Name = $"U-{Guid.NewGuid():N}",
            Email = $"{Guid.NewGuid():N}@test.local",
            PasswordHash = PasswordHasher.Hash(password),
            IsActive = active,
            Roles = [new UserRole { Role = role }],
        };
        Db.Users.Add(user);
        Db.SaveChanges();
        return user;
    }

    [Fact]
    public async Task VerifyCredentials_accepts_correct_rejects_wrong_and_inactive()
    {
        var user = SeedUser("correct-horse");
        Assert.NotNull(await Auth().VerifyCredentialsAsync(user.Email, "correct-horse"));
        Assert.Null(await Auth().VerifyCredentialsAsync(user.Email, "nope"));

        var inactive = SeedUser("pw", active: false);
        Assert.Null(await Auth().VerifyCredentialsAsync(inactive.Email, "pw"));
    }

    [Fact]
    public async Task CheckLogin_reports_an_inactive_account_only_after_the_password_is_verified()
    {
        var active = SeedUser("correct-horse");
        var ok = await Auth().CheckLoginAsync(active.Email, "correct-horse");
        Assert.Equal(LoginStatus.Success, ok.Status);
        Assert.NotNull(ok.User);

        var inactive = SeedUser("pw", active: false);
        var inactiveCorrect = await Auth().CheckLoginAsync(inactive.Email, "pw");
        Assert.Equal(LoginStatus.AccountInactive, inactiveCorrect.Status);
        Assert.Null(inactiveCorrect.User); // never hand back a user to sign in

        // Without the right password, an inactive account looks exactly like any other failure,
        // so the message cannot be used to discover which emails exist or are deactivated.
        Assert.Equal(LoginStatus.InvalidCredentials, (await Auth().CheckLoginAsync(inactive.Email, "wrong")).Status);
        Assert.Equal(LoginStatus.InvalidCredentials, (await Auth().CheckLoginAsync(active.Email, "wrong")).Status);
        Assert.Equal(LoginStatus.InvalidCredentials, (await Auth().CheckLoginAsync("nobody@test.local", "pw")).Status);
    }

    [Fact]
    public async Task CreateTokenPair_issues_a_jwt_with_role_claims_and_stores_a_refresh_token()
    {
        var user = SeedUser("pw", role: Roles.Admin);
        var pair = await Auth().CreateTokenPairAsync(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(pair.AccessToken);
        Assert.Equal(user.Id.ToString(), jwt.Claims.First(c => c.Type == "sub").Value);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == Roles.Admin);

        Assert.True(await Db.RefreshTokens.AnyAsync(t => t.Username == user.Id.ToString()));
    }

    [Fact]
    public async Task Refresh_rotates_the_token_old_revoked_new_active()
    {
        var user = SeedUser("pw");
        var pair = await Auth().CreateTokenPairAsync(user);

        var refreshed = await Auth().RefreshAsync(pair.RefreshToken);
        Assert.NotNull(refreshed);
        Assert.NotEqual(pair.RefreshToken, refreshed!.RefreshToken);

        var tokens = await Db.RefreshTokens.Where(t => t.Username == user.Id.ToString()).ToListAsync();
        Assert.Equal(2, tokens.Count);                       // old + new
        Assert.Equal(1, tokens.Count(t => t.IsActive));       // exactly one still active
        Assert.Contains(tokens, t => t.RevokedAt != null && t.ReplacedByTokenHash != null);
    }

    [Fact]
    public async Task Refresh_returns_null_for_an_unknown_token()
    {
        Assert.Null(await Auth().RefreshAsync("this-token-was-never-issued"));
    }

    [Fact]
    public async Task Refresh_revokes_and_denies_a_deactivated_user()
    {
        var user = SeedUser("pw");
        var pair = await Auth().CreateTokenPairAsync(user);

        user.IsActive = false;
        await Db.SaveChangesAsync();

        Assert.Null(await Auth().RefreshAsync(pair.RefreshToken));
        var tokens = await Db.RefreshTokens.Where(t => t.Username == user.Id.ToString()).ToListAsync();
        Assert.All(tokens, t => Assert.False(t.IsActive));
    }

    [Fact]
    public async Task Revoke_disables_the_refresh_token()
    {
        var user = SeedUser("pw");
        var pair = await Auth().CreateTokenPairAsync(user);

        await Auth().RevokeAsync(pair.RefreshToken);

        Assert.Null(await Auth().RefreshAsync(pair.RefreshToken));
    }

    [Fact]
    public async Task ChangePassword_updates_the_hash_or_reports_the_reason()
    {
        var user = SeedUser("old-pw");

        Assert.Equal(AuthService.ChangePasswordResult.WrongCurrentPassword,
            await Auth().ChangePasswordAsync(user.Id, "not-old", "new-pw"));
        Assert.Equal(AuthService.ChangePasswordResult.UserNotFound,
            await Auth().ChangePasswordAsync(999999, "x", "y"));

        Assert.Equal(AuthService.ChangePasswordResult.Success,
            await Auth().ChangePasswordAsync(user.Id, "old-pw", "new-pw"));
        var reloaded = await Db.Users.FindAsync(user.Id);
        Assert.True(PasswordHasher.Verify("new-pw", reloaded!.PasswordHash));
    }
}
