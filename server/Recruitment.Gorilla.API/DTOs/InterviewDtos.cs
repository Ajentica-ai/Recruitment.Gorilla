using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.DTOs;

public record AssignableUserDto(int Id, string Name, string Email);

public record InterviewInterviewerDto(int UserId, string Name);

/// <summary>Row in a user's personal "My interviews" list.</summary>
public record MyInterviewDto(
    int Id,
    int CandidateId,
    string CandidateName,
    string? Role,
    DateTime ScheduledAt,
    string EvaluationState // "None" | "Draft" | "Submitted"
);

public record EvaluationItemDto(string CriterionKey, int? Rating, string? Comment);

public record InterviewEvaluationDto(
    int Id,
    int InterviewerUserId,
    string InterviewerName,
    string? GeneralAssessment,
    string? Recommendation,
    string? RecommendationOther,
    int? OverallRating,
    bool IsSubmitted,
    DateTime? SubmittedAt,
    List<EvaluationItemDto> Items
);

public record InterviewDetailDto(
    int Id,
    DateTime ScheduledAt,
    CandidateDetailDto Candidate,
    List<InterviewInterviewerDto> Interviewers,
    bool CanEvaluate,                          // caller is an assigned interviewer
    InterviewEvaluationDto? MyEvaluation,      // the caller's evaluation, if any
    List<InterviewEvaluationDto>? AllEvaluations, // Admin+ always; a peer only after submitting their own
    string? Notes,                             // recruiter's note = the scheduled entry's comment
    List<string> InterviewTags,                // interview type tags (Technical, HR, …)
    int DurationMinutes,                       // drives the calendar invite's end time
    string Status = InterviewStatuses.Scheduled  // Scheduled | Cancelled (issue #173)
);

// ----- Reschedule / cancel (issue #173) -----

/// <summary>One entry in a booking's narrative: scheduled, moved, cancelled.</summary>
public record InterviewEventDto(
    string EventType,                  // Scheduled | Rescheduled | Cancelled
    DateTime? PreviousScheduledAt,
    DateTime? NewScheduledAt,
    string? Reason,
    string ActorName,
    DateTime CreatedAt
);

/// <summary>
/// Narrow read model behind GET /api/interviews/{id}/schedule, for prefilling the edit form.
/// Deliberately separate from <see cref="InterviewDetailDto"/>: that one is gated on being an
/// assigned interviewer or Admin+, which would 404 the recruiter who owns the candidate.
/// </summary>
public record InterviewScheduleDto(
    int Id,
    int CandidateId,
    string CandidateName,
    string Status,                     // Scheduled | Cancelled
    DateTime ScheduledAt,
    int DurationMinutes,
    string? Notes,
    List<int> InterviewerUserIds,
    List<int> InterviewTypeOptionIds,
    bool HasSubmittedEvaluation,       // true once any interviewer has submitted: both writes are then blocked
    List<InterviewEventDto> Events
);

/// <summary>Body of PUT /api/interviews/{id}. Fully replaces the schedulable fields.</summary>
public record RescheduleInterviewDto(
    DateTime ScheduledAt,
    int DurationMinutes,
    string? Notes,
    List<int> InterviewerUserIds,
    List<int>? InterviewTypeOptionIds,
    string? Reason                     // optional; quoted in the interviewers' email
);

/// <summary>Body of POST /api/interviews/{id}/cancel.</summary>
public record CancelInterviewDto(string Reason);

public record UpsertEvaluationDto(
    string? GeneralAssessment,
    string? Recommendation,
    string? RecommendationOther,
    int? OverallRating,
    List<EvaluationItemDto>? Items,
    bool Submit
);

// ----- Candidate evaluation report (Recruiter+): every interviewer's full rubric + aggregates -----

public record CandidateEvaluationReportDto(
    int CandidateId,
    string FullName,
    string? RoleApplied,
    EvaluationReportSummaryDto Summary,
    List<ReportEvaluationDto> Evaluations,      // one per submitted evaluation, newest interview first
    // The criteria the ratings were given on (#190): the candidate's rubric, then any rated key it does not
    // know under "Other criteria". Empty when no rubric exists, so the client falls back to the built-in ones.
    List<ReportCriterionDto>? Criteria = null
);

public record ReportCriterionDto(string Key, string Label, string Section);

public record ReportEvaluationDto(
    int InterviewId,
    DateTime ScheduledAt,
    List<string> InterviewTags,
    InterviewEvaluationDto Evaluation
);

public record EvaluationReportSummaryDto(
    int InterviewerCount,
    double? AverageOverall,
    List<RecommendationCountDto> RecommendationCounts,
    List<CriterionAverageDto> CriterionAverages
);

public record RecommendationCountDto(string Recommendation, int Count);

public record CriterionAverageDto(string CriterionKey, double Average, int Count);

public record NotificationDto(
    int Id,
    string Title,
    string Message,
    string? LinkUrl,
    bool IsRead,
    DateTime CreatedAt
);

public record NotificationListDto(List<NotificationDto> Items, int UnreadCount);
