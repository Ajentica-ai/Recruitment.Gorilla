namespace Recruitment.Gorilla.API.Models;

/// <summary>The values <see cref="Interview.Status"/> takes. Deliberately no "Completed":
/// completion stays candidate-driven, as the Interview Completed gate in CandidateService assumes.</summary>
public static class InterviewStatuses
{
    public const string Scheduled = "Scheduled";
    public const string Cancelled = "Cancelled";
}

/// <summary>The values <see cref="InterviewEvent.EventType"/> takes.</summary>
public static class InterviewEventTypes
{
    public const string Scheduled = "Scheduled";
    public const string Rescheduled = "Rescheduled";
    /// <summary>A move to a time that has already passed (#263): the interview happened earlier than booked.</summary>
    public const string RescheduledBackdated = "RescheduledBackdated";
    public const string Cancelled = "Cancelled";
}
