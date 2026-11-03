using System.Net;
using System.Net.Http.Json;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Integration tests: once a user is deactivated, both their access token and their refresh
/// cookie must be rejected by the API immediately — not just after the next token exchange.
/// </summary>
[Collection(ApiCollection.Name)]
public class UserDeactivationTests(ApiFixture fx)
{
    [Fact]
    public async Task Deactivated_user_access_token_is_rejected()
    {
        // Create a fresh user and log them in to capture their access token.
        var (email, id) = await fx.NewActiveUserAsync();

        // Log in as SA first so the SA refresh cookie is NOT the last one set on fx.Client.
        var saToken = await fx.LoginAsync(fx.SuperAdminEmail);

        // Log in as the new user last — their refresh cookie is now current on fx.Client.
        var userToken = await fx.LoginAsync(email);

        // Deactivate via SA token.
        var deactivateResp = await fx.SendAsync(
            HttpMethod.Put,
            $"/api/users/{id}",
            saToken,
            new { name = $"deactivated-{id}", roles = new[] { Roles.Recruiter }, isActive = false });
        Assert.Equal(HttpStatusCode.OK, deactivateResp.StatusCode);

        // The access token must now be rejected.
        var resp = await fx.SendAsync(HttpMethod.Get, "/api/users", userToken);
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Deactivated_user_refresh_token_is_rejected()
    {
        var (email, id) = await fx.NewActiveUserAsync();

        var saToken = await fx.LoginAsync(fx.SuperAdminEmail);
        await fx.LoginAsync(email); // sets the new user's refresh cookie on fx.Client

        var deactivateResp = await fx.SendAsync(
            HttpMethod.Put,
            $"/api/users/{id}",
            saToken,
            new { name = $"deactivated-{id}", roles = new[] { Roles.Recruiter }, isActive = false });
        Assert.Equal(HttpStatusCode.OK, deactivateResp.StatusCode);

        // Attempt to exchange the refresh cookie for a new access token.
        var refreshResp = await fx.Client.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResp.StatusCode);
    }
}
