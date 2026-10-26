namespace Recruitment.Gorilla.API.DTOs;

/// <summary>One interview a grantee was given specifically (rather than all rounds).</summary>
public record SharedInterviewDto(int InterviewId, DateTime ScheduledAt);

/// <summary>
/// A candidate shared with the caller (#184), merged across the caller's active grants for that
/// candidate. <see cref="VisibleEvaluationCount"/> is what the access predicate lets them read now,
/// so it can be lower than what was shared (an interview they still have to evaluate is held back).
/// </summary>
public record SharedEvaluationSummaryDto(
    int CandidateId,
    string CandidateName,
    string? RoleApplied,
    /// <summary>True when any active grant covers every round, including future ones.</summary>
    bool AllRounds,
    /// <summary>The interviews named by interview-specific grants; empty when <see cref="AllRounds"/>.</summary>
    List<SharedInterviewDto> Interviews,
    string? GrantedByName,
    string? Note,
    /// <summary>Null when any active grant never expires; otherwise the latest expiry.</summary>
    DateTime? ExpiresAt,
    int VisibleEvaluationCount
);
