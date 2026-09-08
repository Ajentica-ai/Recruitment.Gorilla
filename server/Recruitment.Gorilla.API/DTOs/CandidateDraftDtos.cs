namespace Recruitment.Gorilla.API.DTOs;

public record CandidateDraftDto(
    int Id,
    string? FullName,
    string? Email,
    string? Phone,
    string? CurrentTitle,
    string? RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    int? RoleAppliedOptionId,
    string? RoleAppliedOptionName,
    int? SourceOptionId,
    string? SourceOptionName,
    string? SourceDetail,
    string OriginalFileName,
    string StoredFileName,
    string FileType,
    long FileSizeBytes,
    string Status,
    string? BatchId,
    string? BatchName,
    int? UploadedByUserId,
    string? UploadedByUserName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record CandidateDraftListItemDto(
    int Id,
    string? FullName,
    string? Email,
    string? Phone,
    string? CurrentTitle,
    string? RelevantExperience,
    string? Skills,
    int? RoleAppliedOptionId,
    string? RoleAppliedOptionName,
    string OriginalFileName,
    string StoredFileName,
    string FileType,
    long FileSizeBytes,
    string Status,
    string? BatchId,
    string? BatchName,
    DateTime CreatedAt,
    string? Location = null
);

public record UpdateCandidateDraftDto(
    string? FullName,
    string? Email,
    string? Phone,
    string? CurrentTitle,
    string? RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    int? RoleAppliedOptionId,
    int? SourceOptionId,
    string? SourceDetail,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record ApproveCandidateDraftDto(
    string? FullName,
    string? Email,
    string? Phone,
    string? CurrentTitle,
    string? RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    int? RoleAppliedOptionId,
    int? SourceOptionId,
    string? SourceDetail,
    List<int>? SkillOptionIds = null,
    bool IsReferred = false,
    string? ReferenceName = null,
    string? ReferenceEmail = null,
    string? ReferenceEmployeeId = null,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record BulkApproveDraftsDto(
    List<int> DraftIds,
    int? DefaultRoleAppliedOptionId = null,
    int? DefaultSourceOptionId = null,
    string? DefaultRelevantExperience = null
);

public record BulkDiscardDraftsDto(
    List<int> DraftIds
);

public record DraftBatchSummaryDto(
    string BatchId,
    string BatchName,
    int TotalDrafts,
    int PendingDrafts,
    int ApprovedDrafts,
    int DiscardedDrafts,
    DateTime CreatedAt
);

public record DraftsFilterQuery(
    string? Status = "Pending",
    string? BatchId = null,
    int? RoleId = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 50,
    int? Cursor = null
);

public record PagedDraftsResultDto(
    List<CandidateDraftListItemDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages,
    int TotalPending,
    int TotalApproved,
    int TotalDiscarded,
    int? NextCursor = null
);
