using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>POST /api/auth/login over the real HTTP pipeline: which message each kind of failure gets.</summary>
[Collection(ApiCollection.Name)]
public class AuthLoginTests(ApiFixture fx)
{
    private const string InvalidMessage = "Invalid email or password.";
    private const string InactiveMessage = "Your account is inactive. Please contact your administrator.";

    private async Task<(HttpResponseMessage Resp, JsonElement Body)> Login(string email, string password)
    {
        var resp = await fx.Client.PostAsJsonAsync("/api/auth/login", new { email, password });
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return (resp, doc.RootElement.Clone());
    }

    [Fact]
    public async Task Inactive_account_with_the_correct_password_gets_a_403_and_the_inactive_message()
    {
        var email = await fx.NewInactiveUserAsync();

        var (resp, body) = await Login(email, ApiFixture.Password);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        Assert.Equal("account_inactive", body.GetProperty("code").GetString());
        Assert.Equal(InactiveMessage, body.GetProperty("message").GetString());
        // Nothing to sign in with: no token in the body and no refresh cookie.
        Assert.False(body.TryGetProperty("token", out _));
        Assert.False(resp.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Inactive_account_with_a_wrong_password_still_gets_the_generic_401()
    {
        var email = await fx.NewInactiveUserAsync();

        var (resp, body) = await Login(email, "not-the-password");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.Equal(InvalidMessage, body.GetProperty("message").GetString());
        Assert.False(body.TryGetProperty("code", out _));
    }

    [Fact]
    public async Task Unknown_email_and_wrong_password_get_the_generic_401()
    {
        var (unknown, unknownBody) = await Login("nobody@test.local", ApiFixture.Password);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(InvalidMessage, unknownBody.GetProperty("message").GetString());

        var (wrong, wrongBody) = await Login(fx.AdminEmail, "not-the-password");
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(InvalidMessage, wrongBody.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Active_account_with_the_correct_password_still_signs_in()
    {
        var (resp, body) = await Login(fx.AdminEmail, ApiFixture.Password);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task The_sign_in_response_carries_the_users_id_so_the_client_can_tell_its_own_pill_from_others()
    {
        var (_, body) = await Login(fx.AdminEmail, ApiFixture.Password);

        Assert.Equal(fx.AdminId, body.GetProperty("userId").GetInt32());
    }
}
