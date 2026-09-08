using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Recruitment.Gorilla.API.Services.Background;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Outbound-email connection settings. Bound from the "Smtp" config section as the fallback, and
/// produced (decrypted) from the DB row by <c>EmailSettingsService</c> when configured in-app.
/// </summary>
public class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string? User { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "Recruitment Gorilla";
    /// <summary>STARTTLS on the given port (587) when true; implicit SSL/TLS (465) when false.</summary>
    public bool UseStartTls { get; set; } = true;
}

/// <summary>The actual network send, isolated behind an interface so tests can substitute a fake.</summary>
public interface ISmtpTransport
{
    Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default);
}

public class MailKitSmtpTransport : ISmtpTransport
{
    public async Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default)
    {
        using var client = new SmtpClient();
        var secure = options.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.SslOnConnect;
        await client.ConnectAsync(options.Host, options.Port, secure, ct);
        if (!string.IsNullOrWhiteSpace(options.User))
            await client.AuthenticateAsync(options.User, options.Password ?? string.Empty, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}

/// <summary>
/// Sends transactional email (interview assignment, password/account notices). SMTP settings are
/// resolved at send time by <see cref="EmailSettingsResolver"/> (DB row if configured in-app, else
/// the <c>Smtp</c> config fallback). Outbound sends are enqueued asynchronously via <see cref="IEmailQueue"/>.
/// </summary>
public class EmailService(
    IEmailSettingsResolver settings,
    ISmtpTransport transport,
    ILogger<EmailService> logger,
    IEmailQueue? queue = null)
{
    /// <summary>Asynchronous non-blocking queue dispatch (or immediate send if queue is not configured in tests).</summary>
    public async Task SendAsync(
        string toEmail, string toName, string subject, string htmlBody, CalendarAttachment? calendar = null)
    {
        try
        {
            if (queue != null)
            {
                await queue.QueueAsync(new EmailJob(toEmail, toName, subject, htmlBody, calendar));
            }
            else
            {
                await SendCoreAsync(toEmail, toName, subject, htmlBody, calendar);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to enqueue email '{Subject}' to {ToEmail}.", subject, toEmail);
        }
    }

    /// <summary>Executes direct send across the network (called by the background queue worker).</summary>
    public Task SendDirectAsync(
        string toEmail, string toName, string subject, string htmlBody, CalendarAttachment? calendar = null) =>
        SendCoreAsync(toEmail, toName, subject, htmlBody, calendar);

    /// <summary>
    /// Send that surfaces the outcome — for the admin "send test" flow, where the caller needs to
    /// know whether SMTP actually worked. Throws <see cref="InvalidOperationException"/> when SMTP
    /// isn't configured; otherwise lets transport exceptions propagate.
    /// </summary>
    public Task SendTestAsync(string toEmail, string toName, string subject, string htmlBody) =>
        SendCoreAsync(toEmail, toName, subject, htmlBody);

    private async Task SendCoreAsync(
        string toEmail, string toName, string subject, string htmlBody, CalendarAttachment? calendar = null)
    {
        if (string.IsNullOrWhiteSpace(toEmail))
            throw new InvalidOperationException("No recipient email address.");

        var options = await settings.ResolveAsync();
        if (string.IsNullOrWhiteSpace(options.Host) || string.IsNullOrWhiteSpace(options.FromAddress))
            throw new InvalidOperationException("SMTP is not configured. Set the host and from-address first.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromAddress));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;

        if (calendar is null)
        {
            message.Body = new TextPart("html") { Text = htmlBody };
        }
        else
        {
            // text/calendar with a METHOD parameter is what makes mail clients show "Add to calendar"
            // natively; the same content is attached as a file so clients that ignore the part still
            // give the recipient something openable.
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
                new TextPart("html") { Text = htmlBody },
                calendarPart,
            };
        }

        await transport.SendAsync(message, options);
    }
}
