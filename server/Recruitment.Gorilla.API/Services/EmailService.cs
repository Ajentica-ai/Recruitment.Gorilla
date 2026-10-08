using MailKit.Net.Smtp;
using MailKit.Security;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;
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
    Task SendAsync(MimeKit.MimeMessage message, SmtpOptions options, CancellationToken ct = default);
}

public class MailKitSmtpTransport : ISmtpTransport
{
    public async Task SendAsync(MimeKit.MimeMessage message, SmtpOptions options, CancellationToken ct = default)
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
/// Entry point callers use to send transactional email (interview assignment, password/account
/// notices). <see cref="SendAsync"/> never throws and never blocks on the network: it writes a durable
/// <see cref="OutboundEmail"/> row and returns — the actual send, retried as needed, happens later in
/// <see cref="EmailOutboxProcessor"/>, so an API restart never loses a pending email.
/// <see cref="SendTestAsync"/> is the one path that still sends immediately through
/// <see cref="IEmailDispatcher"/> and lets failures propagate, for the admin "send test" button, which
/// needs to know right away whether delivery actually works.
/// </summary>
public class EmailService(
    AppDbContext db, IEmailDispatcher dispatcher, ILogger<EmailService> logger, IEmailOutboxSignal? signal = null)
{
    public async Task SendAsync(
        string toEmail, string toName, string subject, string htmlBody, CalendarAttachment? calendar = null)
    {
        if (string.IsNullOrWhiteSpace(toEmail)) return;

        try
        {
            var now = DateTime.UtcNow;
            db.OutboundEmails.Add(new OutboundEmail
            {
                ToEmail = toEmail,
                ToName = toName,
                Subject = subject,
                HtmlBody = htmlBody,
                CalendarFileName = calendar?.FileName,
                CalendarContent = calendar?.Content,
                CalendarMethod = calendar?.Method,
                CreatedAt = now,
                UpdatedAt = now,
                NextAttemptAt = now,
            });
            await db.SaveChangesAsync();

            // Best-effort nudge — if nothing is listening (or the channel is already full), the
            // worker's own polling interval picks the row up regardless, just a bit later.
            signal?.Notify();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to queue email '{Subject}' to {ToEmail}.", subject, toEmail);
        }
    }

    /// <summary>
    /// Send that surfaces the outcome — for the admin "send test" flow, where the caller needs to know
    /// whether delivery actually worked. Bypasses the outbox entirely: it's a one-off diagnostic send,
    /// not a transactional notification that needs retrying.
    /// </summary>
    public Task SendTestAsync(string toEmail, string toName, string subject, string htmlBody) =>
        dispatcher.SendAsync(new EmailSendRequest(toEmail, toName, subject, htmlBody, null, Guid.NewGuid().ToString()));
}
