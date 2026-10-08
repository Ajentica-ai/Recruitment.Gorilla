namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The notification categories a SuperAdmin can route to Slack independently. Keys are stored in
/// <see cref="Models.NotificationChannelSetting"/> and must stay stable once in use (they are the
/// primary key of that table).
/// </summary>
public static class NotificationCategories
{
    public const string InterviewAssigned = "InterviewAssigned";
    public const string EvaluationSubmitted = "EvaluationSubmitted";
    public const string RecruiterAssigned = "RecruiterAssigned";

    /// <summary>Every known category with its admin-facing label, in display order.</summary>
    public static readonly IReadOnlyList<(string Key, string Label)> All =
    [
        (InterviewAssigned, "Interview assigned"),
        (EvaluationSubmitted, "Evaluation submitted"),
        (RecruiterAssigned, "Assigned to job opening"),
    ];

    public static bool IsValid(string category) => All.Any(c => c.Key == category);
}
