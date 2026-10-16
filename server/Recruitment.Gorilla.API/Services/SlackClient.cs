using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Outbound Slack connection settings. Bound from the "Slack" config section as the fallback
/// bot token, and produced (decrypted) from the DB row by <c>SlackSettingsResolver</c> when
/// configured in-app.
/// </summary>
public class SlackOptions
{
    /// <summary>Fallback bot token (xoxb-...), used only when no DB token is usable.</summary>
    public string? BotToken { get; set; }
    public string ApiBaseUrl { get; set; } = "https://slack.com/api/";
    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>
/// A failed Slack Web API call. <see cref="IsTransient"/> tells the queue worker whether it's worth
/// retrying (rate limits, 5xx, network errors) or not (bad token, missing scope, unknown user —
/// retrying would just fail the same way every time).
/// </summary>
public class SlackApiException(string code, bool isTransient, TimeSpan? retryAfter = null, string? neededScope = null, Exception? inner = null)
    : Exception(BuildMessage(code, neededScope), inner)
{
    public string Code { get; } = code;
    public bool IsTransient { get; } = isTransient;
    public TimeSpan? RetryAfter { get; } = retryAfter;
    public string? NeededScope { get; } = neededScope;

    private static string BuildMessage(string code, string? neededScope) =>
        neededScope is null ? $"Slack API error: {code}" : $"Slack API error: {code} (needs scope '{neededScope}')";
}

/// <summary>The actual network call, isolated behind an interface so tests can substitute a fake.</summary>
public interface ISlackTransport
{
    /// <summary>
    /// Calls a Slack Web API method (e.g. "users.lookupByEmail", "chat.postMessage") with the given
    /// form body and bearer token. Returns the parsed JSON body on success; throws
    /// <see cref="SlackApiException"/> on any HTTP or <c>ok:false</c> failure.
    /// </summary>
    Task<JsonElement> CallAsync(
        string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default);
}

public class HttpSlackTransport(HttpClient http) : ISlackTransport
{
    public async Task<JsonElement> CallAsync(
        string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, method)
        {
            Content = new FormUrlEncodedContent(form),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new SlackApiException("network_error", isTransient: true, inner: ex);
        }

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
            throw new SlackApiException("ratelimited", isTransient: true, retryAfter: response.Headers.RetryAfter?.Delta);

        if ((int)response.StatusCode >= 500)
            throw new SlackApiException($"http_{(int)response.StatusCode}", isTransient: true);

        if (!response.IsSuccessStatusCode)
            throw new SlackApiException($"http_{(int)response.StatusCode}", isTransient: false);

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var root = doc.RootElement;

        if (root.TryGetProperty("ok", out var okProp) && okProp.ValueKind == JsonValueKind.True)
            return root.Clone();

        var code = root.TryGetProperty("error", out var errProp) ? errProp.GetString() ?? "unknown_error" : "unknown_error";
        var neededScope = code == "missing_scope" && root.TryGetProperty("needed", out var neededProp)
            ? neededProp.GetString()
            : null;
        throw new SlackApiException(code, isTransient: false, neededScope: neededScope);
    }
}
