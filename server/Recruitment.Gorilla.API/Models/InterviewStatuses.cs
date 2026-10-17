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
    public const string Cancelled = "Cancelled";
}
