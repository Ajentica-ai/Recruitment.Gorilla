using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class AnalyticsService(AppDbContext db)
{
    private static readonly HashSet<string> PositiveTerminal =
        ["Recommended", "Offer Preparation", "Offer Extended", "Offer Accepted", "Hired"];

    private static readonly HashSet<string> NegativeTerminal =
        ["Reject", "Not Recommended", "Discontinued", "Not Available", "Offer Declined"];

    private static readonly HashSet<string> HiredStatuses =
        ["Hired", "Offer Accepted"];

    private static readonly HashSet<string> AssessmentStatuses =
        ["Ask for Assessment", "Technical Assessment", "Submission Received", "Code Review", "Call for Interview"];

    private static readonly HashSet<string> InterviewStatuses =
        ["Interview Scheduled", "Interview Completed"];

    private static readonly HashSet<string> OfferStatuses =
        ["Offer Preparation", "Offer Extended", "Offer Accepted"];

    public async Task<RecruitingAnalyticsSummaryDto> GetSummaryAsync(AnalyticsFilterQuery query, int? ownerScopeUserId = null)
    {
        var now = DateTime.UtcNow;
        var (periodStart, periodEnd) = ResolveDateRange(query, now);
        var (prevStart, prevEnd) = ResolvePreviousPeriod(periodStart, periodEnd);

        // 1. Resolve role scoping if ownerScopeUserId is provided
        HashSet<int>? allowedRoleIds = null;
        if (ownerScopeUserId.HasValue)
        {
            var assignedRoles = await db.RoleRecruiters
                .Where(rr => rr.UserId == ownerScopeUserId.Value)
                .Select(rr => rr.RoleAppliedOptionId)
                .ToListAsync();
            allowedRoleIds = assignedRoles.ToHashSet();
        }

        // Base candidate query
        var candidateQuery = db.Candidates
            .AsNoTracking()
            .Include(c => c.StatusHistories)
            .Include(c => c.SourceOption)
            .Include(c => c.OwnerUser)
            .AsQueryable();

        if (query.RoleId.HasValue)
        {
            candidateQuery = candidateQuery.Where(c => c.RoleAppliedOptionId == query.RoleId.Value);
        }
        else if (allowedRoleIds != null)
        {
            candidateQuery = candidateQuery.Where(c =>
                (c.RoleAppliedOptionId.HasValue && allowedRoleIds.Contains(c.RoleAppliedOptionId.Value)) ||
                c.OwnerUserId == ownerScopeUserId);
        }

        var allCandidates = await candidateQuery.ToListAsync();

        // Candidates active / created in the target period
        var periodCandidates = allCandidates.Where(c =>
            c.CreatedAt >= periodStart && c.CreatedAt <= periodEnd ||
            c.StatusHistories.Any(h => h.ChangedAt >= periodStart && h.ChangedAt <= periodEnd)
        ).ToList();

        // Previous period candidates for trend comparison
        var prevCandidates = allCandidates.Where(c =>
            c.CreatedAt >= prevStart && c.CreatedAt <= prevEnd ||
            c.StatusHistories.Any(h => h.ChangedAt >= prevStart && h.ChangedAt <= prevEnd)
        ).ToList();

        // 2. Time to Hire
        var timeToHire = CalculateTimeToHire(periodCandidates, prevCandidates, periodStart, periodEnd, prevStart, prevEnd);

        // 3. Stage Velocities (Dwell times)
        var stageVelocities = CalculateStageVelocities(periodCandidates, now);

        // Overall pipeline average days across all stages
        var avgPipelineDays = stageVelocities.Count > 0
            ? Math.Round(stageVelocities.Average(s => s.AverageDays), 1)
            : 0;

        // 4. Pipeline Funnel Stages
        var funnelStages = CalculateFunnelStages(periodCandidates);
        var overallConversionRate = funnelStages.Count > 0 && funnelStages[0].TotalEntered > 0
            ? funnelStages.Last().ConversionFromStartPercent
            : 0;

        // 5. Sourcing Channels ROI
        var sourcingChannels = CalculateSourcingPerformance(periodCandidates);

        // 6. Recruiter Workloads
        var recruiterWorkloads = await CalculateRecruiterWorkloadsAsync(allCandidates, periodStart, periodEnd);

        var activeCount = periodCandidates.Count(c =>
            !PositiveTerminal.Contains(c.CurrentStatus) && !NegativeTerminal.Contains(c.CurrentStatus));

        return new RecruitingAnalyticsSummaryDto(
            TimeToHire: timeToHire,
            AveragePipelineDays: avgPipelineDays,
            OverallFunnelConversionRate: overallConversionRate,
            TotalCandidatesInPeriod: periodCandidates.Count,
            ActiveCandidates: activeCount,
            FunnelStages: funnelStages,
            StageVelocities: stageVelocities,
            SourcingChannels: sourcingChannels,
            RecruiterWorkloads: recruiterWorkloads,
            PeriodStart: periodStart,
            PeriodEnd: periodEnd
        );
    }

    private static (DateTime start, DateTime end) ResolveDateRange(AnalyticsFilterQuery query, DateTime now)
    {
        if (query.From.HasValue && query.To.HasValue)
        {
            return (query.From.Value, query.To.Value);
        }

        var preset = query.Preset?.ToLowerInvariant() ?? "30d";
        return preset switch
        {
            "7d" => (now.AddDays(-7), now),
            "90d" => (now.AddDays(-90), now),
            "1y" or "365d" => (now.AddDays(-365), now),
            "all" => (DateTime.UtcNow.AddYears(-5), now),
            _ => (now.AddDays(-30), now)
        };
    }

    private static (DateTime start, DateTime end) ResolvePreviousPeriod(DateTime start, DateTime end)
    {
        var duration = end - start;
        return (start - duration, start);
    }

    private static TimeToHireMetricsDto CalculateTimeToHire(
        List<Candidate> periodCandidates,
        List<Candidate> prevCandidates,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime prevStart,
        DateTime prevEnd)
    {
        var periodHireDays = new List<double>();
        foreach (var c in periodCandidates)
        {
            var hireHistory = c.StatusHistories
                .Where(h => HiredStatuses.Contains(h.Status) && h.ChangedAt >= periodStart && h.ChangedAt <= periodEnd)
                .OrderBy(h => h.ChangedAt)
                .FirstOrDefault();

            if (hireHistory != null)
            {
                var days = Math.Max(1.0, (hireHistory.ChangedAt - c.CreatedAt).TotalDays);
                periodHireDays.Add(days);
            }
            else if (HiredStatuses.Contains(c.CurrentStatus) && c.CreatedAt >= periodStart && c.CreatedAt <= periodEnd)
            {
                var last = c.StatusHistories.OrderByDescending(h => h.ChangedAt).FirstOrDefault();
                var hireDate = last != null ? last.ChangedAt : c.UpdatedAt;
                var days = Math.Max(1.0, (hireDate - c.CreatedAt).TotalDays);
                periodHireDays.Add(days);
            }
        }

        var prevHireDays = new List<double>();
        foreach (var c in prevCandidates)
        {
            var hireHistory = c.StatusHistories
                .Where(h => HiredStatuses.Contains(h.Status) && h.ChangedAt >= prevStart && h.ChangedAt <= prevEnd)
                .OrderBy(h => h.ChangedAt)
                .FirstOrDefault();

            if (hireHistory != null)
            {
                var days = Math.Max(1.0, (hireHistory.ChangedAt - c.CreatedAt).TotalDays);
                prevHireDays.Add(days);
            }
        }

        if (periodHireDays.Count == 0)
        {
            return new TimeToHireMetricsDto(
                AverageDays: 0,
                MedianDays: 0,
                FastestDays: 0,
                LongestDays: 0,
                TotalHires: 0,
                ChangeVsPreviousPeriodPercent: null
            );
        }

        periodHireDays.Sort();
        var avg = Math.Round(periodHireDays.Average(), 1);
        var median = Math.Round(periodHireDays[periodHireDays.Count / 2], 1);
        var fastest = Math.Round(periodHireDays.First(), 1);
        var longest = Math.Round(periodHireDays.Last(), 1);

        double? pctChange = null;
        if (prevHireDays.Count > 0)
        {
            var prevAvg = prevHireDays.Average();
            if (prevAvg > 0)
            {
                pctChange = Math.Round(((avg - prevAvg) / prevAvg) * 100.0, 1);
            }
        }

        return new TimeToHireMetricsDto(
            AverageDays: avg,
            MedianDays: median,
            FastestDays: fastest,
            LongestDays: longest,
            TotalHires: periodHireDays.Count,
            ChangeVsPreviousPeriodPercent: pctChange
        );
    }

    private static List<StageVelocityDto> CalculateStageVelocities(List<Candidate> candidates, DateTime now)
    {
        var stageDurations = new Dictionary<string, List<double>>(StringComparer.OrdinalIgnoreCase);
        var stageCandidateIds = new Dictionary<string, HashSet<int>>(StringComparer.OrdinalIgnoreCase);

        foreach (var c in candidates)
        {
            var histories = c.StatusHistories.OrderBy(h => h.ChangedAt).ToList();
            if (histories.Count == 0)
            {
                var dwell = (now - c.CreatedAt).TotalDays;
                AddDwell(stageDurations, stageCandidateIds, c.CurrentStatus, dwell, c.Id);
                continue;
            }

            for (var i = 0; i < histories.Count; i++)
            {
                var current = histories[i];

                // Skip terminal statuses from pipeline dwell calculation
                if (HiredStatuses.Contains(current.Status) || NegativeTerminal.Contains(current.Status))
                {
                    continue;
                }

                double duration;
                if (i < histories.Count - 1)
                {
                    duration = (histories[i + 1].ChangedAt - current.ChangedAt).TotalDays;
                }
                else
                {
                    if (PositiveTerminal.Contains(current.Status) || NegativeTerminal.Contains(current.Status))
                    {
                        duration = 0;
                    }
                    else
                    {
                        duration = (now - current.ChangedAt).TotalDays;
                    }
                }

                if (duration > 0)
                {
                    AddDwell(stageDurations, stageCandidateIds, current.Status, duration, c.Id);
                }
            }
        }

        var result = new List<StageVelocityDto>();
        var sort = 1;
        foreach (var (stage, list) in stageDurations)
        {
            if (list.Count == 0) continue;
            list.Sort();
            var avg = Math.Round(list.Average(), 1);
            var median = Math.Round(list[list.Count / 2], 1);
            var candidateCount = stageCandidateIds.TryGetValue(stage, out var cSet) ? cSet.Count : list.Count;
            result.Add(new StageVelocityDto(stage, sort++, avg, median, candidateCount));
        }

        return result.OrderByDescending(s => s.AverageDays).ToList();
    }

    private static void AddDwell(Dictionary<string, List<double>> dict, Dictionary<string, HashSet<int>> candidateMap, string stage, double days, int candidateId)
    {
        if (!dict.TryGetValue(stage, out var list))
        {
            list = [];
            dict[stage] = list;
        }
        list.Add(Math.Max(0.1, days));

        if (!candidateMap.TryGetValue(stage, out var set))
        {
            set = [];
            candidateMap[stage] = set;
        }
        set.Add(candidateId);
    }

    private static List<FunnelStageDto> CalculateFunnelStages(List<Candidate> candidates)
    {
        // Define 5 standard pipeline milestones
        var stages = new (string key, string name)[]
        {
            ("Applied", "1. Applied / Uploaded"),
            ("Assessment", "2. Screening & Assessment"),
            ("Interview", "3. Interview Stages"),
            ("Offer", "4. Offer Extended"),
            ("Hired", "5. Hired / Accepted"),
        };

        var totalApplied = candidates.Count;
        var totalAssessment = candidates.Count(c =>
            c.StatusHistories.Any(h => AssessmentStatuses.Contains(h.Status) || InterviewStatuses.Contains(h.Status) || OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
            AssessmentStatuses.Contains(c.CurrentStatus) || InterviewStatuses.Contains(c.CurrentStatus) || OfferStatuses.Contains(c.CurrentStatus) || HiredStatuses.Contains(c.CurrentStatus));

        var totalInterview = candidates.Count(c =>
            c.StatusHistories.Any(h => InterviewStatuses.Contains(h.Status) || OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
            InterviewStatuses.Contains(c.CurrentStatus) || OfferStatuses.Contains(c.CurrentStatus) || HiredStatuses.Contains(c.CurrentStatus));

        var totalOffer = candidates.Count(c =>
            c.StatusHistories.Any(h => OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
            OfferStatuses.Contains(c.CurrentStatus) || HiredStatuses.Contains(c.CurrentStatus));

        var totalHired = candidates.Count(c =>
            c.StatusHistories.Any(h => HiredStatuses.Contains(h.Status)) ||
            HiredStatuses.Contains(c.CurrentStatus));

        var counts = new[] { totalApplied, totalAssessment, totalInterview, totalOffer, totalHired };
        var result = new List<FunnelStageDto>();

        for (var i = 0; i < stages.Length; i++)
        {
            var count = counts[i];
            var prevCount = i == 0 ? count : counts[i - 1];
            var conversionFromStart = totalApplied > 0 ? Math.Round((count * 100.0) / totalApplied, 1) : 0;
            var conversionFromPrev = prevCount > 0 ? Math.Round((count * 100.0) / prevCount, 1) : 0;
            var dropoff = Math.Max(0, prevCount - count);

            result.Add(new FunnelStageDto(
                StageKey: stages[i].key,
                StageName: stages[i].name,
                StepNumber: i + 1,
                TotalEntered: count,
                ConversionFromStartPercent: conversionFromStart,
                ConversionFromPreviousPercent: i == 0 ? 100.0 : conversionFromPrev,
                DropoffCount: i == 0 ? 0 : dropoff
            ));
        }

        return result;
    }

    private static List<SourcePerformanceDto> CalculateSourcingPerformance(List<Candidate> candidates)
    {
        var grouped = candidates
            .GroupBy(c => new { Id = c.SourceOptionId, Name = c.SourceOption?.Name ?? "Direct / Unspecified" })
            .ToList();

        var totalHiresAll = candidates.Count(c =>
            c.StatusHistories.Any(h => HiredStatuses.Contains(h.Status)) || HiredStatuses.Contains(c.CurrentStatus));

        var result = new List<SourcePerformanceDto>();

        foreach (var g in grouped)
        {
            var applicants = g.Count();
            var screened = g.Count(c =>
                c.StatusHistories.Any(h => AssessmentStatuses.Contains(h.Status) || InterviewStatuses.Contains(h.Status) || OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
                AssessmentStatuses.Contains(c.CurrentStatus));

            var interviewed = g.Count(c =>
                c.StatusHistories.Any(h => InterviewStatuses.Contains(h.Status) || OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
                InterviewStatuses.Contains(c.CurrentStatus));

            var offered = g.Count(c =>
                c.StatusHistories.Any(h => OfferStatuses.Contains(h.Status) || HiredStatuses.Contains(h.Status)) ||
                OfferStatuses.Contains(c.CurrentStatus));

            var hired = g.Count(c =>
                c.StatusHistories.Any(h => HiredStatuses.Contains(h.Status)) || HiredStatuses.Contains(c.CurrentStatus));

            var convRate = applicants > 0 ? Math.Round((hired * 100.0) / applicants, 1) : 0;
            var shareOfHires = totalHiresAll > 0 ? Math.Round((hired * 100.0) / totalHiresAll, 1) : 0;

            result.Add(new SourcePerformanceDto(
                SourceId: g.Key.Id,
                SourceName: g.Key.Name,
                TotalApplicants: applicants,
                ScreenedCount: screened,
                InterviewedCount: interviewed,
                OfferedCount: offered,
                HiredCount: hired,
                ConversionToHirePercent: convRate,
                ShareOfTotalHiresPercent: shareOfHires
            ));
        }

        return result.OrderByDescending(s => s.HiredCount).ThenByDescending(s => s.TotalApplicants).ToList();
    }

    private async Task<List<RecruiterWorkloadDto>> CalculateRecruiterWorkloadsAsync(
        List<Candidate> allCandidates,
        DateTime periodStart,
        DateTime periodEnd)
    {
        var users = await db.Users
            .AsNoTracking()
            .Include(u => u.Roles)
            .Where(u => u.IsActive)
            .ToListAsync();

        var recruiters = users
            .Where(u => u.Roles.Any(r => r.Role is "Recruiter" or "Admin" or "SuperAdmin"))
            .ToList();

        var transitions = await db.StatusHistories
            .AsNoTracking()
            .Where(h => h.ChangedAt >= periodStart && h.ChangedAt <= periodEnd)
            .ToListAsync();

        var interviews = await db.InterviewInterviewers
            .AsNoTracking()
            .Include(ii => ii.Interview)
            .Where(ii => ii.Interview.CreatedAt >= periodStart && ii.Interview.CreatedAt <= periodEnd)
            .ToListAsync();

        var result = new List<RecruiterWorkloadDto>();

        foreach (var r in recruiters)
        {
            var assignedCandidates = allCandidates.Where(c => c.OwnerUserId == r.Id).ToList();
            var active = assignedCandidates.Count(c =>
                !PositiveTerminal.Contains(c.CurrentStatus) && !NegativeTerminal.Contains(c.CurrentStatus));

            var userTransitions = transitions.Count(t =>
                string.Equals(t.ChangedBy, r.Name, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t.ChangedBy, r.Email, StringComparison.OrdinalIgnoreCase));

            var userInterviews = interviews.Count(i => i.UserId == r.Id);

            var hired = assignedCandidates.Count(c =>
                c.StatusHistories.Any(h => HiredStatuses.Contains(h.Status) && h.ChangedAt >= periodStart && h.ChangedAt <= periodEnd) ||
                (HiredStatuses.Contains(c.CurrentStatus) && c.CreatedAt >= periodStart && c.CreatedAt <= periodEnd));

            result.Add(new RecruiterWorkloadDto(
                RecruiterUserId: r.Id,
                RecruiterName: r.Name,
                ActiveCandidates: active,
                TotalAssigned: assignedCandidates.Count,
                TransitionsLogged: userTransitions,
                InterviewsParticipated: userInterviews,
                HiresMade: hired
            ));
        }

        return result.OrderByDescending(r => r.HiresMade).ThenByDescending(r => r.ActiveCandidates).ToList();
    }
}
