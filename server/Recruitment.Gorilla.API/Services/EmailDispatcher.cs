using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// How a failed (or ambiguous) send should be handled by <see cref="Background.EmailOutboxProcessor"/>.
/// </summary>
public enum EmailOutcome
{
    /// <summary>Safe to retry: the send clearly never reached the provider, or the provider said so.</summary>
    Retry,
    /// <summary>
    /// The send may or may not have gone through (e.g. a timeout after the request left, or a stale
    /// in-flight row recovered after a crash). Resend only after checking delivery status, where that's
    /// possible, never blindly, since that risks a duplicate.
    /// </summary>
    Ambiguous,
    /// <summary>Retrying would fail the same way every time (bad credentials, rejected recipient, ...).</summary>
    Permanent,
}

/// <summary>
/// A failed send through any email provider. <see cref="Outcome"/> tells the outbox processor whether
/// it's worth retrying, whether a status check is owed first, or whether to stop. Mirrors
/// <see cref="SlackApiException"/>'s transient/permanent split, with the middle "ambiguous" case an HTTP
/// provider can produce (a plain SMTP connection either sends or doesn't, so it never needs it).
/// </summary>
public class EmailDeliveryException(string code, EmailOutcome outcome, TimeSpan? retryAfter = null, Exception? inner = null)
    : Exception(BuildMessage(code, inner), inner)
{
    public string Code { get; } = code;
    public EmailOutcome Outcome { get; } = outcome;
    public TimeSpan? RetryAfter { get; } = retryAfter;

    /// <summary>
    /// Which provider attempted this send. Not a constructor parameter: a throw deep inside a
    /// transport doesn't always have it to hand, so <see cref="EmailDispatcher.SendAsync"/> (the one
    /// place that resolves the provider before delegating to either transport) fills it in as the
    /// exception passes back through, rather than every throw site needing to know or pass it along.
    /// </summary>
    public string? Provider { get; set; }

    // Keeps the short, stable `code` for logs/metrics but doesn't drop the underlying reason: an
    // admin reading "Email delivery error: smtp_auth_failed" on the test-email button has no more
    // information than before the outbox existed; the transport's own message (e.g. "5.7.8 Username
    // and Password not accepted") is what actually tells them what to fix.
    private static string BuildMessage(string code, Exception? inner) =>
        inner is null ? $"Email delivery error: {code}" : $"Email delivery error: {code} ({inner.Message})";
}

/// <summary>Everything one send attempt needs, independent of how it got queued.</summary>
public record EmailSendRequest(
    string ToEmail, string ToName, string Subject, string HtmlBody, CalendarAttachment? Calendar, string Reference);

/// <summary>Which provider actually attempted the send, and the id it gave back, if any.</summary>
public record EmailSendResult(string Provider, string? MessageId);

/// <summary>
/// Sends one email over the network right now, through whichever provider is configured. Throws
/// <see cref="EmailDeliveryException"/> on failure; never retries itself (that's
/// <see cref="Background.EmailOutboxProcessor"/>'s job).
/// </summary>
public interface IEmailDispatcher
{
    Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default);

    /// <summary>
    /// Checks whether a previously attempted send actually went through, for a provider that can
    /// report delivery status. Only meaningful for the HTTP API provider: a plain SMTP send never
    /// produces an <see cref="EmailOutcome.Ambiguous"/> result in the first place, so this path is
    /// never actually exercised by it; it still answers (<see cref="EmailApiDeliveryStatus.Unsupported"/>)
    /// rather than throw, so the caller's logic doesn't need a provider-specific branch.
    /// </summary>
    Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default);
}

/// <summary>
/// Resolves the active provider at send time (DB row if configured in-app, else config, see
/// <see cref="IEmailSettingsResolver"/>) and sends through it: SMTP via <see cref="ISmtpTransport"/>,
/// or the HTTP notification API via <see cref="IEmailApiTransport"/>.
/// </summary>
public class EmailDispatcher(IEmailSettingsResolver settings, ISmtpTransport smtpTransport, IEmailApiTransport apiTransport)
    : IEmailDispatcher
{
    public async Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
    {
        var options = await settings.ResolveAsync();
        try
        {
            var messageId = options.Provider == EmailProviders.HttpApi
                ? await SendViaApiAsync(request, options.Api, ct)
                : await SendViaSmtpAsync(request, options.Smtp, ct);
            return new EmailSendResult(options.Provider, messageId);
        }
        catch (EmailDeliveryException ex)
        {
            // This is the one place that already knows which provider was resolved for this attempt,
            // regardless of which of the two private methods below actually threw.
            ex.Provider ??= options.Provider;
            throw;
        }
    }

    public async Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default)
    {
        var options = await settings.ResolveAsync();
        if (options.Provider != EmailProviders.HttpApi || string.IsNullOrWhiteSpace(options.Api.BaseUrl))
            return new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported);

        return await apiTransport.GetStatusAsync(reference, options.Api, ct);
    }

    private async Task<string?> SendViaSmtpAsync(EmailSendRequest request, SmtpOptions options, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(options.Host) || string.IsNullOrWhiteSpace(options.FromAddress))
            throw new EmailDeliveryException("not_configured", EmailOutcome.Permanent);

        var message = BuildSmtpMessage(request, options);

        try
        {
            await smtpTransport.SendAsync(message, options, ct);
            return null; // plain SMTP has no delivery id to report back
        }
        catch (AuthenticationException ex)
        {
            throw new EmailDeliveryException("smtp_auth_failed", EmailOutcome.Permanent, inner: ex);
        }
        catch (SmtpCommandException ex) when ((int)ex.StatusCode >= 500)
        {
            // SMTP reply codes: 5xx is a permanent negative (bad recipient, policy rejection, ...).
            throw new EmailDeliveryException($"smtp_{(int)ex.StatusCode}", EmailOutcome.Permanent, inner: ex);
        }
        catch (Exception ex)
        {
            // Connection refused/timeout, a transient 4xx, DNS failure, etc.: worth retrying.
            throw new EmailDeliveryException("smtp_transient", EmailOutcome.Retry, inner: ex);
        }
    }

    private async Task<string?> SendViaApiAsync(EmailSendRequest request, EmailApiOptions api, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(api.BaseUrl) || string.IsNullOrWhiteSpace(api.ApiKey))
            throw new EmailDeliveryException("not_configured", EmailOutcome.Permanent);

        if (!IsAllowedRecipient(request.ToEmail, api.AllowedRecipientDomains))
            throw new EmailDeliveryException("recipient_domain_not_allowed", EmailOutcome.Permanent);

        // The contract this service was given has no attachment field yet (SupportsAttachments stays
        // false until one is confirmed), so the calendar invite, when there is one, is never attached
        // here; the note in the body is adjusted to match so it never claims an attachment that isn't
        // there, and the Google/Outlook links above it still work either way.
        var willAttach = request.Calendar is not null && api.SupportsAttachments;
        var html = ApplyCalendarNote(request.HtmlBody, willAttach);
        var text = HtmlToText.Convert(html);

        var apiRequest = new EmailApiSendRequest(request.ToEmail, request.Subject, text, html, api.FromName, request.Reference);
        return await apiTransport.SendAsync(apiRequest, api, ct);
    }

    /// <summary>True when no allow-list is configured, or the recipient's domain is on it. Checked
    /// before the API is ever called, not left for the service to reject.</summary>
    private static bool IsAllowedRecipient(string email, string allowedDomainsCsv)
    {
        if (string.IsNullOrWhiteSpace(allowedDomainsCsv)) return true;

        // MailAddress.TryCreate, plus requiring the round-tripped address to match the input exactly,
        // rejects the forms that would otherwise let the text after the last '@' look like an allowed
        // domain while carrying another address or a header-injection attempt alongside it (e.g.
        // "evil@other.com@ajentica.ai", or a comma/semicolon-separated second recipient).
        if (!System.Net.Mail.MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
            return false;

        return allowedDomainsCsv
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Any(d => string.Equals(d, parsed.Host, StringComparison.OrdinalIgnoreCase));
    }

    private static string ApplyCalendarNote(string html, bool attached) => html.Replace(
        EmailTemplates.CalendarNotePlaceholder,
        attached ? "Or open the attached invite (interview.ics) in any calendar app." : "");

    private static MimeMessage BuildSmtpMessage(EmailSendRequest request, SmtpOptions options)
    {
        var html = ApplyCalendarNote(request.HtmlBody, request.Calendar is not null);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(new MailboxAddress(request.ToName, request.ToEmail));
        message.Subject = request.Subject;

        if (request.Calendar is null)
        {
            message.Body = new TextPart("html") { Text = html };
        }
        else
        {
            // text/calendar with a METHOD parameter is what makes mail clients show "Add to calendar"
            // natively; the same content is attached as a file so clients that ignore the part still
            // give the recipient something openable.
            var calendar = request.Calendar;
            var calendarPart = new TextPart("calendar")
            {
                ContentTransferEncoding = ContentEncoding.Base64,
                Text = calendar.Content,
            };
            // Assigning Text already sets charset; adding it again throws on the duplicate.
            calendarPart.ContentType.Parameters["method"] = calendar.Method;
            calendarPart.ContentType.Name = calendar.FileName;
            calendarPart.ContentDisposition = new ContentDisposition(ContentDisposition.Attachment)
            {
                FileName = calendar.FileName,
            };

            message.Body = new Multipart("mixed")
            {
                new TextPart("html") { Text = html },
                calendarPart,
            };
        }

        return message;
    }
}
