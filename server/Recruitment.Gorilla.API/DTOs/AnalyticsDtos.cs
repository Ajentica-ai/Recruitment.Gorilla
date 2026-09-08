namespace Recruitment.Gorilla.API.DTOs;

public record AnalyticsFilterQuery(
    string? Preset = "30d",
    DateTime? From = null,
    DateTime? To = null,
    int? RoleId = null
);

public record TimeToHireMetricsDto(
    double AverageDays,
    double MedianDays,
    double FastestDays,
    double LongestDays,
    int TotalHires,
    double? ChangeVsPreviousPeriodPercent
);

public record StageVelocityDto(
    string StageName,
    int SortOrder,
    double AverageDays,
    double MedianDays,
    int CandidatesCount
);

public record FunnelStageDto(
    string StageKey,
    string StageName,
    int StepNumber,
    int TotalEntered,
    double ConversionFromStartPercent,
    double ConversionFromPreviousPercent,
    int DropoffCount
);

public record SourcePerformanceDto(
    int? SourceId,
    string SourceName,
    int TotalApplicants,
    int ScreenedCount,
    int InterviewedCount,
    int OfferedCount,
    int HiredCount,
    double ConversionToHirePercent,
    double ShareOfTotalHiresPercent
);

public record RecruiterWorkloadDto(
    int RecruiterUserId,
    string RecruiterName,
    int ActiveCandidates,
    int TotalAssigned,
    int TransitionsLogged,
    int InterviewsParticipated,
    int HiresMade
);

public record RecruitingAnalyticsSummaryDto(
    TimeToHireMetricsDto TimeToHire,
    double AveragePipelineDays,
    double OverallFunnelConversionRate,
    int TotalCandidatesInPeriod,
    int ActiveCandidates,
    List<FunnelStageDto> FunnelStages,
    List<StageVelocityDto> StageVelocities,
    List<SourcePerformanceDto> SourcingChannels,
    List<RecruiterWorkloadDto> RecruiterWorkloads,
    DateTime PeriodStart,
    DateTime PeriodEnd
);
