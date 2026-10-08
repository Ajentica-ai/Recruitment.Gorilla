using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Services.Background;

/// <summary>
/// Claims and sends due <see cref="OutboundEmail"/> rows. Called on an interval by
/// <see cref="EmailOutboxWorker"/> in production, and directly in tests against a transactional
/// <see cref="AppDbContext"/> (same pattern as the rest of the service layer — see
/// <c>Recruitment.Gorilla.Tests.Infrastructure.DbTestBase</c>).
/// </summary>
public class EmailOutboxProcessor(
    AppDbContext db, IEmailDispatcher dispatcher, TimeProvider time, ILogger<EmailOutboxProcessor> logger)
{
    private const int BatchSize = 20;
    private const string SmtpProvider = "Smtp";

    /// <summary>
    /// How long after a failed/ambiguous attempt to try again, indexed by attempt number (0 = after the
    /// first failure). Once attempts exceed this, the email is given up on (<see cref="OutboundEmailStatus.Failed"/>).
    /// </summary>
    public static readonly TimeSpan[] RetryDelays =
        [TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15), TimeSpan.FromHours(1)];

    /// <summary>How long a claimed row is considered "being sent" before another pass treats it as crashed.</summary>
    private static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(2);

    public async Task ProcessDueAsync(CancellationToken ct = default)
    {
        var now = time.GetUtcNow().UtcDateTime;

        var due = await db.OutboundEmails.AsNoTracking()
            .Where(e =>
                (e.Status == OutboundEmailStatus.Pending && e.NextAttemptAt <= now) ||
                (e.Status == OutboundEmailStatus.Sending && e.LockedUntil != null && e.LockedUntil < now))
            .OrderBy(e => e.NextAttemptAt)
            .Take(BatchSize)
            .Select(e => new { e.Id, e.Status })
            .ToListAsync(ct);

        foreach (var row in due)
        {
            if (ct.IsCancellationRequested) break;
            if (await ClaimAsync(row.Id, row.Status, now, ct))
                await SendOneAsync(row.Id, ct);
        }
    }

    /// <summary>
    /// Atomically moves one row from its current status to Sending, so two worker instances racing on
    /// the same due row never both send it — the loser's update matches zero rows. A plain EF read then
    /// write would have the same race the check is meant to close, so this goes straight to the database.
    /// </summary>
    private async Task<bool> ClaimAsync(long id, string fromStatus, DateTime now, CancellationToken ct)
    {
        var updated = await db.OutboundEmails
            .Where(e => e.Id == id && e.Status == fromStatus)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Status, OutboundEmailStatus.Sending)
                .SetProperty(e => e.LockedUntil, now + LockDuration)
                .SetProperty(e => e.UpdatedAt, now), ct);
        return updated == 1;
    }

    private async Task SendOneAsync(long id, CancellationToken ct)
    {
        var row = await db.OutboundEmails.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (row is null) return; // claimed then vanished (shouldn't happen outside tests) — nothing to do

        row.Provider ??= SmtpProvider;
        row.Attempts++;

        try
        {
            var calendar = row.CalendarContent is null ? null
                : new CalendarAttachment(row.CalendarFileName!, row.CalendarContent, row.CalendarMethod!);

            var messageId = await dispatcher.SendAsync(
                new EmailSendRequest(row.ToEmail, row.ToName, row.Subject, row.HtmlBody, calendar, row.Reference), ct);

            row.Status = OutboundEmailStatus.Sent;
            row.ProviderMessageId = messageId;
            row.SentAt = time.GetUtcNow().UtcDateTime;
            row.LockedUntil = null;
            row.NeedsStatusCheck = false;
            row.LastError = null;
        }
        catch (EmailDeliveryException ex)
        {
            Apply(row, ex.Outcome, ex.Code, ex.RetryAfter);
            logger.LogWarning(ex, "Email {Id} to {ToEmail} failed ({Outcome}).", row.Id, row.ToEmail, ex.Outcome);
        }
        catch (Exception ex)
        {
            // An unclassified failure is treated as retryable rather than silently dropped.
            Apply(row, EmailOutcome.Retry, "unexpected_error", null);
            logger.LogError(ex, "Unexpected error sending email {Id} to {ToEmail}.", row.Id, row.ToEmail);
        }

        row.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
    }

    private void Apply(OutboundEmail row, EmailOutcome outcome, string error, TimeSpan? retryAfter)
    {
        row.LastError = Truncate(error, 1000);
        row.LockedUntil = null;

        switch (outcome)
        {
            case EmailOutcome.Permanent:
                row.Status = OutboundEmailStatus.Failed;
                row.NeedsStatusCheck = false;
                break;

            case EmailOutcome.Ambiguous:
                // Not reached by the SMTP dispatcher today (a plain SMTP send either goes through or it
                // doesn't) — kept ready for a provider whose send can time out without telling you which.
                row.Status = OutboundEmailStatus.Pending;
                row.NeedsStatusCheck = true;
                row.NextAttemptAt = time.GetUtcNow().UtcDateTime + TimeSpan.FromMinutes(5);
                break;

            case EmailOutcome.Retry:
            default:
                var delayIndex = row.Attempts - 1;
                if (delayIndex >= RetryDelays.Length)
                {
                    row.Status = OutboundEmailStatus.Failed;
                }
                else
                {
                    row.Status = OutboundEmailStatus.Pending;
                    var delay = retryAfter is { } ra && ra > RetryDelays[delayIndex] ? ra : RetryDelays[delayIndex];
                    row.NextAttemptAt = time.GetUtcNow().UtcDateTime + delay;
                }
                break;
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    /// <summary>Deletes terminal rows past retention — called once an hour by <see cref="EmailOutboxWorker"/>.</summary>
    public async Task PurgeOldAsync(TimeSpan retention, CancellationToken ct = default)
    {
        var cutoff = time.GetUtcNow().UtcDateTime - retention;
        await db.OutboundEmails
            .Where(e => (e.Status == OutboundEmailStatus.Sent || e.Status == OutboundEmailStatus.Failed) && e.UpdatedAt < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}
