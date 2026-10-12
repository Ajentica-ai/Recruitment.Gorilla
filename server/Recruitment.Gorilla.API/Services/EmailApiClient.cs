using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Recruitment.Gorilla.API.Services;

/// <summary>Everything one send through the HTTP notification API needs.</summary>
public record EmailApiSendRequest(string ToEmail, string Subject, string TextBody, string? HtmlBody, string? FromName, string Reference);

/// <summary>The outcome <see cref="IEmailApiTransport.GetStatusAsync"/> reports for a previously sent email.</summary>
public enum EmailApiDeliveryStatus
{
    Sent,
    Failed,
    Pending,
    /// <summary>The provider has no record of this reference: safe to resend.</summary>
    NotFound,
    /// <summary>The provider couldn't be asked (no status endpoint, or it didn't answer meaningfully).
    /// Never auto-resent from this: the row is left for an admin to decide.</summary>
    Unsupported,
}

public record EmailApiStatusResult(EmailApiDeliveryStatus Status, string? MessageId = null);

/// <summary>The actual network calls, isolated behind an interface so tests can substitute a fake.</summary>
public interface IEmailApiTransport
{
    /// <summary>
    /// Sends one email. Returns the provider's message id on success; throws
    /// <see cref="EmailDeliveryException"/> otherwise, classified into an <see cref="EmailOutcome"/>.
    /// </summary>
    Task<string?> SendAsync(EmailApiSendRequest request, EmailApiOptions options, CancellationToken ct = default);

    /// <summary>
    /// Checks delivery status for a previously sent reference. Never throws: a failure to even ask
    /// (network error, the service has no such endpoint) comes back as <see cref="EmailApiDeliveryStatus.Unsupported"/>,
    /// since the caller's only safe move either way is "don't guess, let an admin decide".
    /// </summary>
    Task<EmailApiStatusResult> GetStatusAsync(string reference, EmailApiOptions options, CancellationToken ct = default);
}

/// <summary>
/// Talks to the company's HR notification HTTP API (<c>POST /send-email</c>, <c>X-API-Key</c> auth).
/// The base URL is admin-editable at any time, so (unlike <see cref="HttpSlackTransport"/>'s Slack
/// endpoint) it's never baked into the <see cref="HttpClient"/>'s <c>BaseAddress</c>: every call
/// builds its own absolute URI from <see cref="EmailApiOptions.BaseUrl"/>.
/// </summary>
public class HttpEmailApiTransport(HttpClient http) : IEmailApiTransport
{
    private static readonly TimeSpan MaxRetryAfter = TimeSpan.FromHours(1);

    public async Task<string?> SendAsync(EmailApiSendRequest request, EmailApiOptions options, CancellationToken ct = default)
    {
        var body = new Dictionary<string, object?>
        {
            ["to"] = request.ToEmail,
            ["subject"] = request.Subject,
            ["body"] = request.TextBody,
        };
        if (!string.IsNullOrEmpty(request.HtmlBody)) body["html"] = request.HtmlBody;
        if (!string.IsNullOrEmpty(request.FromName)) body["from_name"] = request.FromName;

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, BuildUri(options.BaseUrl, "send-email"))
        {
            Content = JsonContent.Create(body),
        };
        httpRequest.Headers.Add("X-API-Key", options.ApiKey ?? string.Empty);
        // Same value on every retry of this email, so a service that recognises one can de-duplicate
        // a resend that follows an Ambiguous outcome instead of sending it twice.
        httpRequest.Headers.Add("Idempotency-Key", request.Reference);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(httpRequest, ct);
        }
        catch (HttpRequestException ex)
        {
            // The request never reached the service (DNS failure, connection refused): nothing to
            // undo, so a retry is safe.
            throw new EmailDeliveryException("network_error", EmailOutcome.Retry, inner: ex);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            // The HttpClient's own timeout fired, not the caller's cancellation: the request may have
            // reached the service before the connection was abandoned, so whether it was sent is
            // genuinely unknown.
            throw new EmailDeliveryException("timeout", EmailOutcome.Ambiguous, inner: ex);
        }

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // Capped: an unbounded Retry-After (malicious, buggy, or arriving via a redirect target
            // that is none of these three) would otherwise leave the row "Pending" for that entire
            // span with no visible failure, silently dropping the notification for far longer than
            // anyone would actually wait.
            var retryAfter = response.Headers.RetryAfter?.Delta is { } ra && ra < MaxRetryAfter ? ra : MaxRetryAfter;
            throw new EmailDeliveryException("rate_limited", EmailOutcome.Retry, retryAfter);
        }
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new EmailDeliveryException("invalid_api_key", EmailOutcome.Permanent);
        if ((int)response.StatusCode >= 500)
            throw new EmailDeliveryException($"http_{(int)response.StatusCode}", EmailOutcome.Retry);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await ReadErrorAsync(response, ct);
            throw new EmailDeliveryException($"http_{(int)response.StatusCode}", EmailOutcome.Permanent,
                inner: string.IsNullOrEmpty(detail) ? null : new Exception(detail));
        }

        var responseBody = await ReadBodyAsync(response, ct);
        if (responseBody.Status == "sent")
            return responseBody.MessageId;

        if (responseBody.Error == "recipient_not_allowed")
            throw new EmailDeliveryException("recipient_not_allowed", EmailOutcome.Permanent);

        // A 2xx response that doesn't say "sent" is a response we don't recognise, not a confirmed
        // failure: treat it the same as a timeout rather than assume either outcome.
        throw new EmailDeliveryException(responseBody.Error ?? responseBody.Status ?? "unexpected_response", EmailOutcome.Ambiguous);
    }

    public async Task<EmailApiStatusResult> GetStatusAsync(string reference, EmailApiOptions options, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildUri(options.BaseUrl, $"emails/{Uri.EscapeDataString(reference)}"));
        request.Headers.Add("X-API-Key", options.ApiKey ?? string.Empty);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception)
        {
            return new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported);
        }

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            // A 404 that spells out {"status":"not_found"} means "we checked and there is no such
            // email", which is safe to resend from. A plain 404 means the service has no such route
            // at all (every reference would 404), so it's an unanswerable question, not an answer.
            var notFoundBody = await ReadBodyAsync(response, ct);
            return new EmailApiStatusResult(
                notFoundBody.Status == "not_found" ? EmailApiDeliveryStatus.NotFound : EmailApiDeliveryStatus.Unsupported);
        }

        if (!response.IsSuccessStatusCode)
            return new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported);

        var body = await ReadBodyAsync(response, ct);
        return body.Status switch
        {
            "sent" => new EmailApiStatusResult(EmailApiDeliveryStatus.Sent, body.MessageId),
            "failed" => new EmailApiStatusResult(EmailApiDeliveryStatus.Failed),
            "pending" => new EmailApiStatusResult(EmailApiDeliveryStatus.Pending),
            _ => new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported),
        };
    }

    /// <summary>Joins a base URL (with or without a trailing slash) and a relative path, since the
    /// base is free text an admin typed into a form rather than a value this code controls.</summary>
    private static Uri BuildUri(string baseUrl, string path) =>
        new(baseUrl.TrimEnd('/') + "/" + path.TrimStart('/'));

    /// <summary>
    /// Parses the three fields any response body might carry, in one pass: a response's content
    /// stream can only be read once, so <c>status</c>, <c>error</c> and <c>message_id</c> all have to
    /// come out of the same parse rather than three separate re-reads.
    /// </summary>
    private static async Task<(string? Status, string? Error, string? MessageId)> ReadBodyAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;
            var status = root.TryGetProperty("status", out var s) ? s.GetString() : null;
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
            var messageId = root.TryGetProperty("message_id", out var m) ? m.GetString() : null;
            return (status, error, messageId);
        }
        catch (JsonException)
        {
            return (null, null, null);
        }
    }

    private static async Task<string> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            return text.Length > 200 ? text[..200] : text;
        }
        catch
        {
            return string.Empty;
        }
    }
}
