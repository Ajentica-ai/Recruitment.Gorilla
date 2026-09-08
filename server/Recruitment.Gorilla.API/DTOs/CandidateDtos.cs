namespace Recruitment.Gorilla.API.DTOs;

public record CandidateEducationDto(
    int Id,
    string Degree,
    string Institution,
    string? GraduationYear,
    string? Cgpa
);

public record CandidateExperienceDto(
    int Id,
    string JobTitle,
    string Company,
    string? Duration,
    string? Description
);

public record CVDraftDto(
    string? FullName,
    string? Email,
    string? Phone,
    string? CurrentTitle,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string OriginalFileName,
    string StoredFileName,
    string FileType,
    long FileSizeBytes,
    int? Id = null,
    string? BatchId = null,
    string? BatchName = null,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record CreateCandidateDto(
    string FullName,
    string Email,
    string? Phone,
    string? CurrentTitle,
    string RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    string? AppliedRole,
    bool IsReferred,
    string? ReferenceName,
    string? ReferenceEmail,
    string? ReferenceEmployeeId,
    int? RoleAppliedOptionId,
    List<int>? SkillOptionIds,
    string StoredFileName,
    string OriginalFileName,
    string FileType,
    long FileSizeBytes,
    string InitialStatus,
    string? InitialStatusComment,
    // Deprecated: the server now derives the actor from the authenticated user.
    // Kept nullable for back-compat so omitting it doesn't fail model validation.
    string? ChangedBy = null,
    bool AllowDuplicate = false,
    // Where the candidate came from. Optional — appended so existing positional callers are unaffected.
    int? SourceOptionId = null,
    string? SourceDetail = null,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record DuplicateCandidateDto(
    string Message,
    CandidateListItemDto Existing
);

public record CvFileResult(
    string PhysicalPath,
    string OriginalFileName,
    string ContentType
);

public record UpdateCandidateDto(
    string FullName,
    string Email,
    string? Phone,
    string? CurrentTitle,
    string RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    string? AppliedRole,
    bool IsReferred,
    string? ReferenceName,
    string? ReferenceEmail,
    string? ReferenceEmployeeId,
    int? RoleAppliedOptionId,
    List<int>? SkillOptionIds,
    int? SourceOptionId = null,
    string? SourceDetail = null,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record StatusChangeDto(
    string Status,
    string? Comment = null,
    string? TaskDetails = null,
    string? SubmissionUrl = null,
    DateTime? InterviewAt = null,
    // Required (non-empty) when Status == "Interview Scheduled": the users to assign
    // as interviewers. Each must be an existing active user.
    List<int>? InterviewerUserIds = null,
    // Optional when Status == "Interview Scheduled": interview type tags (Technical, HR, …).
    // Each must be an active InterviewTypeOption.
    List<int>? InterviewTypeOptionIds = null,
    // Deprecated: the server now derives the actor from the authenticated user.
    string? ChangedBy = null,
    // Optional when Status == "Interview Scheduled": how long the interview runs. Drives the end
    // time on the calendar invite. Appended last so existing positional construction is unaffected.
    int? InterviewDurationMinutes = null
);

public record CandidateListItemDto(
    int Id,
    string FullName,
    string Email,
    string? Phone,
    string? CurrentTitle,
    string? AppliedRole,
    string CurrentStatus,
    DateTime CreatedAt,
    string? Source = null,
    DateTime? UpdatedAt = null,
    string? BatchName = null
);

/// <summary>
/// Filter/sort/paging parameters for the candidate list. Search matches name, email or phone;
/// SkillIds is ANY-of; Sort is whitelisted to name|status|added (default added), Dir to asc|desc
/// (default desc). Access scoping is applied separately and always wins.
///
/// <para><c>Bucket</c> is a dashboard pipeline bucket (see <see cref="Services.CandidateBuckets"/>)
/// — recommended | rejected | in-process | new-this-week. It exists because those tiles span
/// several statuses or a date window, which <c>Status</c> (a single exact match) cannot express;
/// without it a KPI tile had no destination that reproduced its own count. Unknown values are
/// ignored rather than rejected, so a stale link degrades to an unfiltered list.</para>
/// </summary>
public record CandidateListQuery(
    string? Search = null,
    string? Status = null,
    int? RoleId = null,
    List<int>? SkillIds = null,
    bool ReferredOnly = false,
    string? Bucket = null,
    string? Sort = null,
    string? Dir = null,
    int Page = 1,
    int PageSize = 20,
    string? Batch = null
);

public record CandidateDetailDto(
    int Id,
    string FullName,
    string Email,
    string? Phone,
    string? CurrentTitle,
    string RelevantExperience,
    string? Skills,
    string? Summary,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    string? AppliedRole,
    bool IsReferred,
    string? ReferenceName,
    string? ReferenceEmail,
    string? ReferenceEmployeeId,
    int? RoleAppliedOptionId,
    string? RoleApplied,
    List<SkillOptionDto> SkillOptions,
    string CurrentStatus,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<CVFileDto> CVFiles,
    List<StatusHistoryDto> StatusHistory,
    DateTime? RoleEndDate,   // the applied-for job opening's closing date, if any
    bool RoleClosed,         // true when RoleEndDate has passed → edits/status locked
    int? SourceOptionId = null,
    string? Source = null,   // the source option's name, for display
    string? SourceDetail = null,
    string? Location = null,
    string? LeetCodeUrl = null,
    string? CodeforcesUrl = null,
    string? HackerRankUrl = null,
    string? GitLabUrl = null,
    List<CandidateEducationDto>? Educations = null,
    List<CandidateExperienceDto>? Experiences = null
);

public record CVFileDto(
    int Id,
    string OriginalFileName,
    string FileType,
    long FileSizeBytes,
    DateTime UploadedAt
);

public record StatusHistoryDto(
    int Id,
    string Status,
    string? Comment,
    string? TaskDetails,
    string? SubmissionUrl,
    DateTime? InterviewAt,
    DateTime ChangedAt,
    string ChangedBy,
    int? InterviewId,
    List<InterviewInterviewerDto> Interviewers,
    List<string> InterviewTags,
    // Live per-interviewer evaluation summary for an "Interview Completed" entry (empty otherwise).
    List<EvaluationSummaryDto> EvaluationSummaries
);

public record EvaluationSummaryDto(
    string InterviewerName,
    int? OverallRating,
    string? Recommendation,
    string? RecommendationOther,
    DateTime? SubmittedAt
);

public record StatusOptionDto(
    int Id,
    string Name,
    int SortOrder,
    bool IsInitial
);

public record RecruiterDto(int UserId, string Name);

public record RoleAppliedOptionDto(
    int Id,
    string Name,
    int SortOrder,
    bool IsActive,
    string? Location,
    string? Department,
    string? Priority,
    DateTime CreatedAt,   // = posted date (read-only)
    DateTime EndDate,
    string Title,         // computed: "{Name} — {CreatedAt:dd MMM yyyy}"
    List<RecruiterDto> Recruiters,
    int? EvaluationRubricId = null,
    string? EvaluationRubricName = null,
    int CandidateCount = 0);

public record UpsertRoleAppliedOptionDto(
    string Name,
    int SortOrder,
    bool IsActive,
    DateTime EndDate,
    string? Location = null,
    string? Department = null,
    string? Priority = null,
    List<int>? RecruiterUserIds = null,
    int? EvaluationRubricId = null);

public record CandidateSourceOptionDto(int Id, string Name, int SortOrder, bool IsActive);

public record UpsertCandidateSourceOptionDto(string Name, int SortOrder, bool IsActive);

public record SkillOptionDto(int Id, string Name, int SortOrder, bool IsActive);

public record UpsertSkillOptionDto(string Name, int SortOrder, bool IsActive);

public record InterviewTypeOptionDto(int Id, string Name, int SortOrder, bool IsActive);

public record UpsertInterviewTypeOptionDto(string Name, int SortOrder, bool IsActive);

public record PagedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
