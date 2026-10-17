namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Append-only narrative of a booking's life: scheduled, moved, cancelled. Separate from
/// <see cref="StatusHistory"/>, which records the candidate's status and must not be
/// re-asserted when only the interview's date changes.
/// </summary>
public class InterviewEvent
{
    public int Id { get; set; }

    public int InterviewId { get; set; }
    public Interview Interview { get; set; } = null!;

    /// <summary>Scheduled | Rescheduled | Cancelled.</summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>The time the interview was at before this event (null on the first Scheduled event).</summary>
    public DateTime? PreviousScheduledAt { get; set; }

    /// <summary>The time it moved to (null on a Cancelled event).</summary>
    public DateTime? NewScheduledAt { get; set; }

    /// <summary>Why it moved or was cancelled; required by the API on cancel.</summary>
    public string? Reason { get; set; }

    /// <summary>Who did it (SetNull on user delete).</summary>
    public int? ActorUserId { get; set; }
    public User? ActorUser { get; set; }

    /// <summary>
    /// Denormalized actor name, exactly as <see cref="StatusHistory.ChangedBy"/> is, so the
    /// trace still reads correctly after the user is deleted.
    /// </summary>
    public string ActorName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
