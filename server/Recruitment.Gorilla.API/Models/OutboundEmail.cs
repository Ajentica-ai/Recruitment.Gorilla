namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Terminal and in-flight delivery states for an <see cref="OutboundEmail"/> row. Plain string
/// constants (the project's convention for small status sets — see <c>Offer.Status</c>,
/// <c>NotificationCategories</c>) rather than an enum, so values are self-describing in the database
/// and in the delivery-log API without a lookup table.
/// </summary>
public static class OutboundEmailStatus
{
    /// <summary>Waiting for its next attempt (new, or scheduled to retry).</summary>
    public const string Pending = "Pending";
    /// <summary>A worker currently has this row claimed and is sending it.</summary>
    public const string Sending = "Sending";
    public const string Sent = "Sent";
    /// <summary>Exhausted its retries, or failed for a reason retrying won't fix.</summary>
    public const string Failed = "Failed";
    /// <summary>
    /// The send's outcome could not be determined (e.g. the provider's delivery status can't be
    /// checked) — an admin resends by hand rather than risk a duplicate.
    /// </summary>
    public const string Unknown = "Unknown";
}

/// <summary>
/// One outbound transactional email, queued durably in the database rather than in memory, so an API
/// restart never loses a pending send. Written by <see cref="EmailService.SendAsync"/>, worked off by
/// <see cref="Services.Background.EmailOutboxProcessor"/>. The body is kept (not just a reference) so
/// a retry or an admin resend doesn't depend on the caller's original data still being around.
/// </summary>
public class OutboundEmail
{
    public long Id { get; set; }

    /// <summary>Stable per email — doubles as the idempotency key sent to a provider that supports one.</summary>
    public string Reference { get; set; } = Guid.NewGuid().ToString();

    public string ToEmail { get; set; } = string.Empty;
    public string ToName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;

    public string? CalendarFileName { get; set; }
    public string? CalendarContent { get; set; }
    public string? CalendarMethod { get; set; }

    public string Status { get; set; } = OutboundEmailStatus.Pending;

    /// <summary>Which provider actually attempted the send, set on the first attempt ("Smtp" today).</summary>
    public string? Provider { get; set; }

    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set while a worker owns this row; a value in the past means a worker crashed mid-send.</summary>
    public DateTime? LockedUntil { get; set; }

    /// <summary>
    /// True when the last attempt's outcome was unclear and a provider status check is owed before any
    /// resend. Unused by the SMTP-only path (set by a future provider whose send can time out
    /// ambiguously), kept on the row now so adding one later needs no migration.
    /// </summary>
    public bool NeedsStatusCheck { get; set; }

    public string? LastError { get; set; }
    public string? ProviderMessageId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
