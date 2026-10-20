namespace Recruitment.Gorilla.API.DTOs;

/// <summary>
/// Share a candidate's submitted evaluations with named users (#183). An empty or missing
/// <see cref="InterviewIds"/> means every round of the candidate, future rounds included.
/// </summary>
public record CreateEvaluationSharesDto(
    List<int> GranteeUserIds,
    List<int>? InterviewIds = null,
    DateTime? ExpiresAt = null,
    string? Note = null
);

public record EvaluationShareDto(
    int Id,
    int CandidateId,
    /// <summary>Null = all rounds of the candidate.</summary>
    int? InterviewId,
    DateTime? InterviewScheduledAt,
    int GranteeUserId,
    string GranteeName,
    string GranteeEmail,
    string Source,
    string? Note,
    DateTime? ExpiresAt,
    bool IsActive,
    int? GrantedByUserId,
    string? GrantedByName,
    DateTime CreatedAt,
    DateTime? RevokedAt,
    int? RevokedByUserId,
    string? RevokedByName
);

/// <summary>A person left out of a share because they can already read every evaluation of this candidate.</summary>
public record SkippedGranteeDto(int UserId, string Name, string Reason);

public record CreateEvaluationSharesResultDto(
    List<EvaluationShareDto> Shares,
    List<SkippedGranteeDto> Skipped
);
