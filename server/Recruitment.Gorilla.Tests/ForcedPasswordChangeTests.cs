using System.Net;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// #264: a user whose password change is still pending (a new user with a temporary password, or after an admin reset)
/// must be refused by every API endpoint except change-password, not just steered away by the client. Before, the
/// requirement sat only on the fallback policy, which ASP.NET applies to endpoints with no authorization metadata at
/// all, so every [Authorize] controller let such a token straight through.
/// </summary>
[Collection(ApiCollection.Name)]
public class ForcedPasswordChangeTests(ApiFixture fx)
{
    private const string NewPassword = "Br4nd-New-Pass!";

    /// <summary>One endpoint per kind of authorization attribute, plus a role-gated one.</summary>
    public static TheoryData<string> Endpoints => new()
    {
        "/api/candidates",                 // class-level [Authorize] + role
        "/api/dashboard/kpis",             // class-level [Authorize]
        "/api/interviews/mine",            // [Authorize] open to every role
        "/api/notifications",              // the shell polls this
        "/api/config/job-opening-options/location", // Admin or above
    };

    [Theory]
    [MemberData(nameof(Endpoints))]
    public async Task A_user_with_a_pending_password_change_is_refused_on_every_endpoint(string url)
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(Roles.Recruiter);
        var token = await fx.LoginAsync(email);

        var resp = await fx.SendAsync(HttpMethod.Get, url, token);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Theory]
    [InlineData(Roles.SuperAdmin)]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Interviewer)]
    public async Task A_role_does_not_get_around_the_pending_change(string role)
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(role);
        var token = await fx.LoginAsync(email);

        // Open to every role, and Admin-only: both refused while the change is pending.
        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine", token)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Get, "/api/config/job-opening-options/location", token)).StatusCode);
    }

    [Fact]
    public async Task The_upload_progress_hub_is_refused_too()
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(Roles.Recruiter);
        var pending = await fx.LoginAsync(email);
        var normal = await fx.LoginAsync(fx.RecruiterEmail);

        var refused = await fx.SendAsync(HttpMethod.Post, "/hubs/cv-upload/negotiate?negotiateVersion=1", pending);
        var allowed = await fx.SendAsync(HttpMethod.Post, "/hubs/cv-upload/negotiate?negotiateVersion=1", normal);

        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_is_still_allowed_and_then_the_same_calls_work()
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(Roles.Recruiter);
        var pending = await fx.LoginAsync(email);
        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine", pending)).StatusCode);

        var change = await fx.SendAsync(HttpMethod.Post, "/api/auth/change-password", pending,
            new { currentPassword = ApiFixture.Password, newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        // A fresh sign-in carries no pending-change claim.
        var after = await fx.LoginAsync(email, NewPassword);
        foreach (var url in new[] { "/api/candidates", "/api/dashboard/kpis", "/api/interviews/mine", "/api/notifications" })
            Assert.Equal(HttpStatusCode.OK, (await fx.SendAsync(HttpMethod.Get, url, after)).StatusCode);
    }

    [Fact]
    public async Task A_wrong_current_password_is_answered_by_the_endpoint_not_blocked_by_the_gate()
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(Roles.Recruiter);
        var pending = await fx.LoginAsync(email);

        var resp = await fx.SendAsync(HttpMethod.Post, "/api/auth/change-password", pending,
            new { currentPassword = "not-the-password", newPassword = NewPassword });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Sign_in_and_sign_out_still_work_while_a_change_is_pending()
    {
        var (email, _) = await fx.NewMustChangePasswordUserAsync(Roles.Recruiter);
        var pending = await fx.LoginAsync(email); // login itself answers 200

        var logout = await fx.SendAsync(HttpMethod.Post, "/api/auth/logout", pending);

        Assert.True(logout.StatusCode is HttpStatusCode.NoContent or HttpStatusCode.OK, logout.StatusCode.ToString());
    }

    [Fact]
    public async Task Users_without_a_pending_change_and_anonymous_callers_are_unaffected()
    {
        var normal = await fx.LoginAsync(fx.RecruiterEmail);

        Assert.Equal(HttpStatusCode.OK, (await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine", normal)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine", token: null)).StatusCode);
    }
}
