using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The tests in here read or write the origin <see cref="PublicLinks"/> remembers from signed-in requests, which
/// is process-wide, so they never run alongside other tests.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class PublicLinksStateCollection
{
    public const string Name = "public-links-state";
}

/// <summary>
/// #327: links in emails and Slack pointed at http://localhost:8090 in production, because the deployment runs on
/// the compose default for App:ClientBaseUrl. The base URL now comes from a real configured address, else the
/// browser's Origin, else nothing.
/// </summary>
[Collection(PublicLinksStateCollection.Name)]
public class PublicLinksTests : IDisposable
{
    public PublicLinksTests() => PublicLinks.ForgetLastSignedInOrigin();
    public void Dispose() => PublicLinks.ForgetLastSignedInOrigin();

    private static IConfiguration Config(string? clientBaseUrl) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:ClientBaseUrl"] = clientBaseUrl })
            .Build();

    [Theory]
    [InlineData("http://localhost:8090")] // the compose default production ran on
    [InlineData("http://localhost:5173")] // the appsettings.json default
    [InlineData("http://LOCALHOST")]
    [InlineData("http://127.0.0.1:8090")]
    [InlineData("http://[::1]:8090")]
    [InlineData("http://0.0.0.0:8090")]
    [InlineData("http://app.localhost")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("recruitment.example.com")] // no scheme
    [InlineData("ftp://recruitment.example.com")]
    public void A_loopback_blank_or_invalid_configured_url_counts_as_not_configured(string? value) =>
        Assert.Null(PublicLinks.ConfiguredBaseUrl(value));

    [Theory]
    [InlineData("https://recruitment.example.com", "https://recruitment.example.com")]
    [InlineData("https://recruitment.example.com/", "https://recruitment.example.com")]
    [InlineData("http://10.0.0.5:8090", "http://10.0.0.5:8090")]
    [InlineData("https://example.com/ats/", "https://example.com/ats")] // a sub-path deployment keeps its path
    public void A_real_configured_url_is_used_without_a_trailing_slash(string value, string expected) =>
        Assert.Equal(expected, PublicLinks.ConfiguredBaseUrl(value));

    [Theory]
    [InlineData("https://recruitment.example.com", "https://recruitment.example.com")]
    [InlineData("https://recruitment.example.com:443", "https://recruitment.example.com")]
    [InlineData("http://203.0.113.10:8090", "http://203.0.113.10:8090")]
    [InlineData("http://localhost:5173", "http://localhost:5173")] // the browser really is on localhost in dev
    public void A_bare_browser_origin_is_accepted(string header, string expected) =>
        Assert.Equal(expected, PublicLinks.ParseOrigin(header));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("null")] // sandboxed iframes and some privacy contexts
    [InlineData("https://recruitment.example.com/interviews")]
    [InlineData("https://recruitment.example.com?x=1")]
    [InlineData("https://user:pass@recruitment.example.com")]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://recruitment.example.com")]
    [InlineData("recruitment.example.com")]
    public void Anything_but_a_bare_http_origin_is_ignored(string? header) =>
        Assert.Null(PublicLinks.ParseOrigin(header));

    [Fact]
    public void The_browser_origin_replaces_the_localhost_default()
    {
        using (PublicLinks.UseRequestOrigin("https://recruitment.example.com"))
            Assert.Equal("https://recruitment.example.com", PublicLinks.BaseUrl(Config("http://localhost:8090")));
    }

    [Fact]
    public void A_real_configured_url_wins_over_the_browser_origin()
    {
        using (PublicLinks.UseRequestOrigin("https://someone-else.example"))
            Assert.Equal("https://recruitment.example.com", PublicLinks.BaseUrl(Config("https://recruitment.example.com")));
    }

    [Fact]
    public void With_neither_there_is_no_base_url_rather_than_a_localhost_one() =>
        Assert.Null(PublicLinks.BaseUrl(Config("http://localhost:8090")));

    [Fact]
    public void The_request_origin_is_cleared_when_the_scope_ends()
    {
        using (PublicLinks.UseRequestOrigin("https://recruitment.example.com")) { }
        Assert.Null(PublicLinks.BaseUrl(Config(null)));
    }

    private static HttpContext Request(string? origin, bool signedIn)
    {
        var ctx = new DefaultHttpContext();
        if (origin is not null) ctx.Request.Headers.Origin = origin;
        if (signedIn)
            ctx.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "1")], "Bearer"));
        return ctx;
    }

    [Fact]
    public async Task The_middleware_exposes_the_origin_while_the_request_runs()
    {
        string? during = null;
        await PublicLinks.TrackRequestOriginAsync(Request("https://recruitment.example.com", signedIn: false), () =>
        {
            during = PublicLinks.BaseUrl(Config(null));
            return Task.CompletedTask;
        });

        Assert.Equal("https://recruitment.example.com", during);
        Assert.Null(PublicLinks.BaseUrl(Config(null))); // anonymous: not remembered afterwards
    }

    [Fact]
    public async Task A_signed_in_origin_is_remembered_for_background_work()
    {
        await PublicLinks.TrackRequestOriginAsync(
            Request("https://recruitment.example.com", signedIn: true), () => Task.CompletedTask);

        // Outside any request, e.g. the evaluation reminder worker.
        Assert.Equal("https://recruitment.example.com", PublicLinks.BaseUrl(Config("http://localhost:8090")));
    }

    [Fact]
    public async Task An_anonymous_request_cannot_change_the_remembered_origin()
    {
        await PublicLinks.TrackRequestOriginAsync(
            Request("https://recruitment.example.com", signedIn: true), () => Task.CompletedTask);
        await PublicLinks.TrackRequestOriginAsync(
            Request("https://attacker.example", signedIn: false), () => Task.CompletedTask);

        Assert.Equal("https://recruitment.example.com", PublicLinks.BaseUrl(Config(null)));
    }

    [Fact]
    public async Task A_signed_in_request_without_an_origin_keeps_the_remembered_one()
    {
        await PublicLinks.TrackRequestOriginAsync(
            Request("https://recruitment.example.com", signedIn: true), () => Task.CompletedTask);
        string? during = null;
        await PublicLinks.TrackRequestOriginAsync(Request(null, signedIn: true), () =>
        {
            during = PublicLinks.BaseUrl(Config(null));
            return Task.CompletedTask;
        });

        Assert.Equal("https://recruitment.example.com", during);
    }
}
