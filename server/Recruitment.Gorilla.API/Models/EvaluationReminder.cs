namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Which overdue-evaluation reminders have gone to an interviewer for an interview (#202): how many, and when the last
/// one was sent, so the reminder job can keep to its interval and its maximum across restarts. One row per
/// interview and interviewer; rows go with the interview.
/// </summary>
public class EvaluationReminder
{
    public int InterviewId { get; set; }
    public Interview Interview { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>How many reminders this interviewer has had for this interview.</summary>
    public int Count { get; set; }

    public DateTime LastSentAt { get; set; }
}
