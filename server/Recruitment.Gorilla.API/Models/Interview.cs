namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// A scheduled interview for a candidate, created when the candidate moves to the
/// "Interview Scheduled" status. Carries the assigned interviewers and their evaluations.
/// </summary>
public class Interview
{
    public int Id { get; set; }

    public int CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    /// <summary>The "Interview Scheduled" history entry that created this interview.</summary>
    public int? StatusHistoryId { get; set; }
    public StatusHistory? StatusHistory { get; set; }

    public DateTime ScheduledAt { get; set; }

    /// <summary>Scheduled | Cancelled. A string, not an enum, matching <see cref="Offer.Status"/>.</summary>
    public string Status { get; set; } = InterviewStatuses.Scheduled;

    /// <summary>How long the interview runs. Calendar invites need an end time, not just a start.</summary>
    public int DurationMinutes { get; set; } = 60;

    /// <summary>The user who scheduled the interview (SetNull on user delete).</summary>
    public int? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>The user who last moved or cancelled the interview (SetNull on user delete).</summary>
    public int? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }

    public DateTime? UpdatedAt { get; set; }

    /// <summary>
    /// iCalendar SEQUENCE for this booking's UID. Clients ignore a re-issued invite whose
    /// SEQUENCE has not increased, so it has to survive restarts and be stored per interview.
    /// </summary>
    public int CalendarSequence { get; set; }

    /// <summary>
    /// Recruiter notes for the interviewers. Reads fall back to the creating
    /// <see cref="StatusHistory"/>'s comment, so interviews booked before this column keep working.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// The recruiter ticked "Share earlier rounds' evaluations with this panel" (#187). While set, each
    /// panelist holds a <c>PanelAutoShare</c> grant on every earlier non-cancelled round, kept in step
    /// with the panel and revoked on cancel. Off by default: the peer rule's anti-anchoring stays the norm.
    /// </summary>
    public bool ShareEarlierRoundsWithPanel { get; set; }

    public ICollection<InterviewEvent> Events { get; set; } = [];

    public ICollection<InterviewInterviewer> Interviewers { get; set; } = [];
    public ICollection<InterviewEvaluation> Evaluations { get; set; } = [];
    public ICollection<InterviewTag> Tags { get; set; } = [];
}
