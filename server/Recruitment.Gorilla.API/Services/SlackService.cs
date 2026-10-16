using Recruitment.Gorilla.API.Services.Background;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Sends Slack direct messages for notifications routed to Slack by category (see
/// <see cref="NotificationCategories"/>). Recipients are found by their app email via
/// <c>users.lookupByEmail</c> — there is no stored Slack user id and no per-user opt-out, so a
/// recipient simply not existing in the workspace is a silent no-op, not an error. Outbound sends
/// are enqueued asynchronously via <see cref="ISlackQueue"/>, mirroring <see cref="EmailService"/>.
/// </summary>
public class SlackService(
    ISlackSettingsResolver settings,
    ISlackTransport transport,
    IConfiguration config,
    ILogger<SlackService> logger,
    ISlackQueue? queue = null)
{
    private const int MaxTextLength = 3000;

    /// <summary>
    /// Asynchronous non-blocking queue dispatch (or immediate send if queue is not configured in
    /// tests). A no-op when the category isn't routed to Slack, no token is configured, or the
    /// recipient has no email on file. Never throws — a Slack failure must never break the caller.
    /// </summary>
    public async Task EnqueueAsync(string category, string? toEmail, string title, string message, string? linkUrl)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(toEmail)) return;
            if (!await settings.IsCategoryEnabledAsync(category)) return;

            var text = BuildText(title, message, linkUrl);
            if (queue != null)
                await queue.QueueAsync(new SlackJob(toEmail, text));
            else
                await SendCoreAsync(toEmail, text);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to enqueue Slack DM to {ToEmail}.", toEmail);
        }
    }

    /// <summary>Executes direct send across the network (called by the background queue worker).</summary>
    public Task SendDirectAsync(string toEmail, string text) => SendCoreAsync(toEmail, text);

    /// <summary>
    /// Send that surfaces the outcome — for the admin "send test" flow, where the caller needs to
    /// know whether Slack actually worked. Throws <see cref="InvalidOperationException"/> when Slack
    /// isn't configured; otherwise lets transport exceptions (including "user not found") propagate.
    /// </summary>
    public Task SendTestAsync(string toEmail) => SendCoreAsync(toEmail, BuildText(
        "Recruitment Gorilla — Slack test",
        "This is a test message from Recruitment Gorilla. Your Slack settings are working.", null));

    private async Task SendCoreAsync(string toEmail, string text)
    {
        var token = await settings.ResolveTokenAsync()
            ?? throw new InvalidOperationException("Slack is not configured. Set the bot token first.");

        var lookup = await transport.CallAsync(token, "users.lookupByEmail",
            new Dictionary<string, string> { ["email"] = toEmail });
        var slackUserId = lookup.GetProperty("user").GetProperty("id").GetString()
            ?? throw new SlackApiException("users_not_found", isTransient: false);

        // Untrusted candidate/job names are mrkdwn-escaped above, but Slack still auto-links bare
        // URLs and @names in plain text regardless of escaping — turn that off explicitly so a
        // crafted name can't render as a clickable link or ping someone from this bot.
        await transport.CallAsync(token, "chat.postMessage", new Dictionary<string, string>
        {
            ["channel"] = slackUserId,
            ["text"] = text,
            ["unfurl_links"] = "false",
            ["unfurl_media"] = "false",
            ["link_names"] = "false",
        });
    }

    private string BuildText(string title, string message, string? linkUrl)
    {
        var text = $"*{Escape(title)}*\n{Escape(message)}";

        if (!string.IsNullOrWhiteSpace(linkUrl))
        {
            var baseUrl = config["App:ClientBaseUrl"]?.TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(baseUrl))
                text += $"\n<{baseUrl}{linkUrl}|Open in Recruitment Gorilla>";
        }

        return text.Length > MaxTextLength ? text[..(MaxTextLength - 1)] + "…" : text;
    }

    /// <summary>
    /// Escapes Slack mrkdwn's special characters so untrusted text (a candidate or job opening name)
    /// can't break the message formatting or forge a link/channel mention.
    /// </summary>
    private static string Escape(string text) =>
        text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
