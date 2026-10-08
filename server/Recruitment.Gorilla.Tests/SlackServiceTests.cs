using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// SlackService: best-effort DM send — pure, no DB, no real network (fake ISlackTransport + resolver).
/// </summary>
public class SlackServiceTests
{
    private sealed class RecordingSlackTransport : ISlackTransport
    {
        public readonly List<(string Method, IReadOnlyDictionary<string, string> Form)> Calls = [];

        /// <summary>The Slack user id returned by users.lookupByEmail, or null to simulate "not found".</summary>
        public string? LookupResult = "U123";

        public Task<JsonElement> CallAsync(
            string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default)
        {
            Calls.Add((method, form));

            if (method == "users.lookupByEmail")
            {
                if (LookupResult is null)
                    throw new SlackApiException("users_not_found", isTransient: false);
                var json = """{"ok":true,"user":{"id":"REPLACE"}}""".Replace("REPLACE", LookupResult);
                return Task.FromResult(JsonDocument.Parse(json).RootElement);
            }

            return Task.FromResult(JsonDocument.Parse("""{"ok":true}""").RootElement);
        }
    }

    private sealed class ThrowingSlackTransport : ISlackTransport
    {
        public Task<JsonElement> CallAsync(
            string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default) =>
            throw new SlackApiException("invalid_auth", isTransient: false);
    }

    private static IConfiguration Config(string? clientBaseUrl = "http://localhost:5173") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:ClientBaseUrl"] = clientBaseUrl })
            .Build();

    private static SlackService Slack(
        ISlackTransport transport, string? token = "xoxb-test", string[]? enabledCategories = null, IConfiguration? config = null) =>
        new(new FakeSlackSettingsResolver(token, enabledCategories ?? [NotificationCategories.InterviewAssigned]),
            transport, config ?? Config(), NullLogger<SlackService>.Instance);

    [Fact]
    public async Task EnqueueAsync_looks_up_then_posts_when_the_category_is_routed_to_slack()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com", "Interview assigned", "You have been assigned.", "/interviews/1");

        Assert.Equal(["users.lookupByEmail", "chat.postMessage"], transport.Calls.Select(c => c.Method));
        Assert.Equal("a@b.com", transport.Calls[0].Form["email"]);
        Assert.Equal("U123", transport.Calls[1].Form["channel"]);
        Assert.Contains("*Interview assigned*", transport.Calls[1].Form["text"]);
        Assert.Contains("You have been assigned.", transport.Calls[1].Form["text"]);
    }

    [Fact]
    public async Task EnqueueAsync_skips_silently_when_the_recipient_is_not_in_the_slack_workspace()
    {
        var transport = new RecordingSlackTransport { LookupResult = null };
        var ex = await Record.ExceptionAsync(() =>
            Slack(transport).EnqueueAsync(NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Message", null));

        Assert.Null(ex);
    }

    [Fact]
    public async Task EnqueueAsync_does_nothing_when_no_token_is_configured()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport, token: null).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Message", null);

        Assert.Empty(transport.Calls);
    }

    [Fact]
    public async Task EnqueueAsync_does_nothing_when_the_category_is_not_routed_to_slack()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport, enabledCategories: [NotificationCategories.EvaluationSubmitted]).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Message", null);

        Assert.Empty(transport.Calls);
    }

    [Fact]
    public async Task EnqueueAsync_ignores_a_blank_recipient()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport).EnqueueAsync(NotificationCategories.InterviewAssigned, "", "Title", "Message", null);

        Assert.Empty(transport.Calls);
    }

    [Fact]
    public async Task EnqueueAsync_escapes_mrkdwn_special_characters_and_appends_an_absolute_link()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com",
            "Title", "Candidate <Smith & Co> applied", "/candidates/1");

        var text = transport.Calls[1].Form["text"];
        Assert.Contains("Candidate &lt;Smith &amp; Co&gt; applied", text);
        Assert.Contains("<http://localhost:5173/candidates/1|Open in Recruitment Gorilla>", text);
    }

    [Fact]
    public async Task EnqueueAsync_omits_the_link_line_when_no_client_base_url_is_configured()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport, config: Config(null)).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Message", "/candidates/1");

        Assert.DoesNotContain("Open in Recruitment Gorilla", transport.Calls[1].Form["text"]);
    }

    [Fact]
    public async Task EnqueueAsync_truncates_text_over_3000_characters()
    {
        var transport = new RecordingSlackTransport();
        await Slack(transport).EnqueueAsync(
            NotificationCategories.InterviewAssigned, "a@b.com", "Title", new string('x', 4000), null);

        var text = transport.Calls[1].Form["text"];
        Assert.Equal(3000, text.Length);
        Assert.EndsWith("…", text);
    }

    [Fact]
    public async Task EnqueueAsync_swallows_a_transport_failure_and_never_throws()
    {
        var ex = await Record.ExceptionAsync(() =>
            Slack(new ThrowingSlackTransport()).EnqueueAsync(NotificationCategories.InterviewAssigned, "a@b.com", "T", "M", null));

        Assert.Null(ex);
    }

    [Fact]
    public async Task SendTestAsync_lets_a_transport_failure_propagate()
    {
        await Assert.ThrowsAsync<SlackApiException>(() =>
            Slack(new ThrowingSlackTransport()).SendTestAsync("a@b.com"));
    }

    [Fact]
    public async Task SendTestAsync_throws_when_slack_is_not_configured()
    {
        var service = Slack(new RecordingSlackTransport(), token: null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SendTestAsync("a@b.com"));
    }
}
