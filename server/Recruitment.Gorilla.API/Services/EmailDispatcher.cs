using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// How a failed (or ambiguous) send should be handled by <see cref="Background.EmailOutboxProcessor"/>.
/// </summary>
public enum EmailOutcome
{
    /// <summary>Safe to retry — the send clearly never reached the provider, or the provider said so.</summary>
    Retry,
    /// <summary>
    /// The send may or may not have gone through (e.g. a timeout after the request left, or a stale
    /// in-flight row recovered after a crash). Resend only after checking delivery status, where that's
    /// possible — never blindly, since that risks a duplicate.
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

    // Keeps the short, stable `code` for logs/metrics but doesn't drop the underlying reason — an
    // admin reading "Email delivery error: smtp_auth_failed" on the test-email button has no more
    // information than before the outbox existed; the transport's own message (e.g. "5.7.8 Username
    // and Password not accepted") is what actually tells them what to fix.
    private static string BuildMessage(string code, Exception? inner) =>
        inner is null ? $"Email delivery error: {code}" : $"Email delivery error: {code} ({inner.Message})";
}

/// <summary>Everything one send attempt needs, independent of how it got queued.</summary>
public record EmailSendRequest(
    string ToEmail, string ToName, string Subject, string HtmlBody, CalendarAttachment? Calendar, string Reference);

/// <summary>
/// Sends one email over the network right now, through whichever provider is configured. Throws
/// <see cref="EmailDeliveryException"/> on failure; never retries itself — that's
/// <see cref="Background.EmailOutboxProcessor"/>'s job. Returns a provider message id when the provider
/// gives one (plain SMTP gives none).
/// </summary>
public interface IEmailDispatcher
{
    Task<string?> SendAsync(EmailSendRequest request, CancellationToken ct = default);
}

/// <summary>
/// The SMTP-only dispatcher. Resolves the effective SMTP settings at send time (DB row if configured
/// in-app, else the <c>Smtp</c> config fallback — see <see cref="IEmailSettingsResolver"/>), builds the
/// MIME message (optionally attaching the interview <c>.ics</c> invite as a <c>text/calendar</c> part)
/// and hands it to <see cref="ISmtpTransport"/>.
/// </summary>
public class EmailDispatcher(IEmailSettingsResolver settings, ISmtpTransport transport) : IEmailDispatcher
{
    public async Task<string?> SendAsync(EmailSendRequest request, CancellationToken ct = default)
    {
        var options = await settings.ResolveAsync();
        if (string.IsNullOrWhiteSpace(options.Host) || string.IsNullOrWhiteSpace(options.FromAddress))
            throw new EmailDeliveryException("not_configured", EmailOutcome.Permanent);

        var message = Build(request, options);

        try
        {
            await transport.SendAsync(message, options, ct);
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
            // Connection refused/timeout, a transient 4xx, DNS failure, etc. — worth retrying.
            throw new EmailDeliveryException("smtp_transient", EmailOutcome.Retry, inner: ex);
        }
    }

    private static MimeMessage Build(EmailSendRequest request, SmtpOptions options)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(new MailboxAddress(request.ToName, request.ToEmail));
        message.Subject = request.Subject;

        if (request.Calendar is null)
        {
            message.Body = new TextPart("html") { Text = request.HtmlBody };
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
                new TextPart("html") { Text = request.HtmlBody },
                calendarPart,
            };
        }

        return message;
    }
}
