using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Interviews and their evaluations. Access to an interview is granted to its assigned
/// interviewers or to Admin+ (this intentionally bypasses candidate owner-scoping —
/// being assigned grants read access to the candidate snapshot).
/// </summary>
public class InterviewService(AppDbContext db, CandidateService candidateService, NotificationService notificationService)
{
    /// <summary>True if the user is an assigned interviewer on any interview of this candidate.</summary>
    public Task<bool> IsAssignedInterviewerForCandidateAsync(int candidateId, int userId) =>
        db.Interviews.AnyAsync(i =>
            i.CandidateId == candidateId && i.Interviewers.Any(ii => ii.UserId == userId));

    /// <summary>Active users assignable as interviewers (any role).</summary>
    public async Task<List<AssignableUserDto>> GetAssignableUsersAsync() =>
        await db.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.Name)
            .Select(u => new AssignableUserDto(u.Id, u.Name, u.Email))
            .ToListAsync();

    /// <summary>Interviews the user is assigned to (most recent first) with their eval state.</summary>
    public async Task<List<MyInterviewDto>> GetMineAsync(int userId)
    {
        var rows = await db.Interviews
            .Where(i => i.Interviewers.Any(ii => ii.UserId == userId))
            .OrderByDescending(i => i.ScheduledAt)
            .Select(i => new
            {
                i.Id,
                i.CandidateId,
                i.Candidate.FullName,
                Role = i.Candidate.RoleAppliedOption != null
                    ? i.Candidate.RoleAppliedOption.Name
                    : i.Candidate.AppliedRole,
                i.ScheduledAt,
                Eval = i.Evaluations
                    .Where(e => e.InterviewerUserId == userId)
                    .Select(e => new { e.IsSubmitted })
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return rows
            .Select(x => new MyInterviewDto(
                x.Id, x.CandidateId, x.FullName, x.Role, x.ScheduledAt,
                x.Eval is null ? "None" : x.Eval.IsSubmitted ? "Submitted" : "Draft"))
            .ToList();
    }

    /// <summary>
    /// Interview detail if the caller may see it (assigned interviewer or Admin+), else null.
    /// Admin+ additionally get every interviewer's evaluation, and the candidate's status history;
    /// for everyone else the history is stripped, because it carries other rounds' ratings and
    /// recommendations (issue #116).
    /// </summary>
    public async Task<InterviewDetailDto?> GetDetailAsync(int id, int userId, bool isAdmin)
    {
        var interview = await db.Interviews
            .Include(i => i.Interviewers).ThenInclude(ii => ii.User)
            .Include(i => i.Evaluations).ThenInclude(e => e.InterviewerUser)
            .Include(i => i.Evaluations).ThenInclude(e => e.Items)
            .Include(i => i.StatusHistory)
            .Include(i => i.Tags).ThenInclude(t => t.InterviewTypeOption)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (interview is null) return null;

        var isAssigned = interview.Interviewers.Any(ii => ii.UserId == userId);
        if (!isAssigned && !isAdmin) return null; // no access → treat as not found

        var candidate = await candidateService.GetByIdAsync(interview.CandidateId);
        if (candidate is null) return null;

        // The interview page renders a read-only profile and never the timeline, so none of this is
        // missed. Shipping it handed an interviewer every status comment and, through
        // StatusHistoryDto.EvaluationSummaries, the rating and recommendation from every completed
        // round, including ones they were never assigned to. That is the anchoring the peer rule
        // below is there to prevent, so it has to go before the caller is a non-admin.
        if (!isAdmin) candidate = candidate with { StatusHistory = [] };

        var interviewers = interview.Interviewers
            .OrderBy(ii => ii.User.Name)
            .Select(ii => new InterviewInterviewerDto(ii.UserId, ii.User.Name))
            .ToList();

        var myEval = interview.Evaluations.FirstOrDefault(e => e.InterviewerUserId == userId);
        // Admin+ see every evaluation (incl. drafts). A peer interviewer sees the OTHER assigned
        // interviewers' *submitted* evaluations — but only once they've submitted & locked their
        // own (so they aren't anchored by a colleague first); never their own, never drafts.
        List<InterviewEvaluationDto>? allEvals =
            isAdmin
                ? interview.Evaluations.OrderBy(e => e.InterviewerUser.Name).Select(ToDto).ToList()
                : myEval is { IsSubmitted: true }
                    ? interview.Evaluations
                        .Where(e => e.InterviewerUserId != userId && e.IsSubmitted)
                        .OrderBy(e => e.InterviewerUser.Name).Select(ToDto).ToList()
                    : null;

        var tags = interview.Tags
            .Select(t => t.InterviewTypeOption.Name)
            .OrderBy(n => n)
            .ToList();

        return new InterviewDetailDto(
            interview.Id, interview.ScheduledAt, candidate, interviewers,
            isAssigned, myEval is null ? null : ToDto(myEval), allEvals,
            interview.StatusHistory?.Comment, tags, interview.DurationMinutes);
    }

    /// <summary>
    /// A candidate's evaluation report: every interviewer's full (submitted) rubric across all the
    /// candidate's interviews, plus aggregates (average overall, per-criterion averages,
    /// recommendation tally). Access is candidate-scoped via <paramref name="ownerScope"/>
    /// (recruiters only see their accessible candidates); returns null when not accessible.
    /// </summary>
    public async Task<CandidateEvaluationReportDto?> GetCandidateEvaluationReportAsync(
        int candidateId, int? ownerScope)
    {
        // Reuse the candidate access predicate (owned OR assigned-role; Admin+ = null scope).
        var candidate = await candidateService.GetByIdAsync(candidateId, ownerScope);
        if (candidate is null) return null;

        var interviews = await db.Interviews
            .Where(i => i.CandidateId == candidateId)
            .Include(i => i.Evaluations).ThenInclude(e => e.InterviewerUser)
            .Include(i => i.Evaluations).ThenInclude(e => e.Items)
            .Include(i => i.Tags).ThenInclude(t => t.InterviewTypeOption)
            .OrderByDescending(i => i.ScheduledAt)
            .ToListAsync();

        var reportEvals = new List<ReportEvaluationDto>();
        foreach (var interview in interviews)
        {
            var tags = interview.Tags
                .Select(t => t.InterviewTypeOption.Name)
                .OrderBy(n => n)
                .ToList();
            foreach (var e in interview.Evaluations
                         .Where(e => e.IsSubmitted)
                         .OrderBy(e => e.InterviewerUser != null ? e.InterviewerUser.Name : ""))
            {
                reportEvals.Add(new ReportEvaluationDto(
                    interview.Id, interview.ScheduledAt, tags, ToDto(e)));
            }
        }

        var overalls = reportEvals
            .Select(r => r.Evaluation.OverallRating)
            .Where(o => o is not null)
            .Select(o => o!.Value)
            .ToList();

        var recommendationCounts = reportEvals
            .Where(r => !string.IsNullOrWhiteSpace(r.Evaluation.Recommendation))
            .GroupBy(r => r.Evaluation.Recommendation!)
            .Select(g => new RecommendationCountDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count).ThenBy(x => x.Recommendation)
            .ToList();

        var criterionAverages = EvaluationCriteria.Keys
            .Select(key =>
            {
                var ratings = reportEvals
                    .SelectMany(r => r.Evaluation.Items)
                    .Where(it => it.CriterionKey == key && it.Rating is not null)
                    .Select(it => it.Rating!.Value)
                    .ToList();
                return new CriterionAverageDto(key, ratings.Count > 0 ? ratings.Average() : 0, ratings.Count);
            })
            .Where(c => c.Count > 0)
            .ToList();

        var summary = new EvaluationReportSummaryDto(
            reportEvals.Count,
            overalls.Count > 0 ? overalls.Average() : null,
            recommendationCounts,
            criterionAverages);

        return new CandidateEvaluationReportDto(
            candidate.Id, candidate.FullName, candidate.RoleApplied ?? candidate.AppliedRole,
            summary, reportEvals);
    }

    /// <summary>
    /// Creates or updates the caller's evaluation for an interview. Only an assigned
    /// interviewer may write; a submitted evaluation is locked (Conflict).
    /// </summary>
    public async Task<(InterviewEvaluationDto? Dto, string? Error, bool NotFound, bool Conflict)>
        UpsertEvaluationAsync(int interviewId, int userId, UpsertEvaluationDto dto)
    {
        var interview = await db.Interviews
            .Include(i => i.Candidate)
            .Include(i => i.Interviewers)
            .Include(i => i.Evaluations).ThenInclude(e => e.Items)
            .Include(i => i.Evaluations).ThenInclude(e => e.InterviewerUser)
            .FirstOrDefaultAsync(i => i.Id == interviewId);

        if (interview is null || !interview.Interviewers.Any(ii => ii.UserId == userId))
            return (null, null, true, false);

        // Resolve rubric criteria for this candidate / interview
        HashSet<string> validKeys;
        if (!string.IsNullOrWhiteSpace(interview.Candidate?.AppliedRole))
        {
            var roleOption = await db.RoleAppliedOptions
                .Include(r => r.EvaluationRubric).ThenInclude(er => er!.Criteria)
                .FirstOrDefaultAsync(r => r.Name == interview.Candidate.AppliedRole);

            if (roleOption?.EvaluationRubric is { IsActive: true } er && er.Criteria.Count > 0)
            {
                validKeys = er.Criteria.Select(c => c.Key).ToHashSet();
            }
            else
            {
                var defaultRubric = await db.EvaluationRubrics
                    .Include(r => r.Criteria)
                    .FirstOrDefaultAsync(r => r.IsDefault && r.IsActive);
                validKeys = defaultRubric?.Criteria.Count > 0
                    ? defaultRubric.Criteria.Select(c => c.Key).ToHashSet()
                    : EvaluationCriteria.Keys.ToHashSet();
            }
        }
        else
        {
            var defaultRubric = await db.EvaluationRubrics
                .Include(r => r.Criteria)
                .FirstOrDefaultAsync(r => r.IsDefault && r.IsActive);
            validKeys = defaultRubric?.Criteria.Count > 0
                ? defaultRubric.Criteria.Select(c => c.Key).ToHashSet()
                : EvaluationCriteria.Keys.ToHashSet();
        }

        if (dto.Recommendation is not null && !EvaluationCriteria.Recommendations.Contains(dto.Recommendation))
            return (null, "Invalid recommendation.", false, false);
        if (dto.Recommendation == "Other" && string.IsNullOrWhiteSpace(dto.RecommendationOther))
            return (null, "Please specify the recommendation.", false, false);
        if (dto.OverallRating is int orr && orr is < 1 or > 5)
            return (null, "Overall rating must be between 1 and 5.", false, false);
        if (dto.Items is not null)
        {
            foreach (var it in dto.Items)
            {
                if (!validKeys.Contains(it.CriterionKey))
                    return (null, $"Unknown criterion '{it.CriterionKey}'.", false, false);
                if (it.Rating is int r && r is < 1 or > 5)
                    return (null, "Ratings must be between 1 and 5.", false, false);
            }
        }

        // Submit is the final, locking action → require a fully-scored rubric. Drafts stay
        // unrestricted so interviewers can save partial progress.
        if (dto.Submit)
        {
            if (string.IsNullOrWhiteSpace(dto.Recommendation))
                return (null, "A final recommendation is required to submit.", false, false);
            if (dto.OverallRating is null)
                return (null, "An overall rating is required to submit.", false, false);

            var ratedKeys = (dto.Items ?? [])
                .Where(it => it.Rating is not null)
                .Select(it => it.CriterionKey)
                .ToHashSet();
            if (!validKeys.All(ratedKeys.Contains))
                return (null, "Please rate all evaluation criteria before submitting.", false, false);
        }

        var eval = interview.Evaluations.FirstOrDefault(e => e.InterviewerUserId == userId);
        if (eval is { IsSubmitted: true })
            return (null, "This evaluation has already been submitted.", false, true);

        if (eval is null)
        {
            eval = new InterviewEvaluation { InterviewId = interviewId, InterviewerUserId = userId };
            db.InterviewEvaluations.Add(eval);
        }

        eval.GeneralAssessment = dto.GeneralAssessment;
        eval.Recommendation = dto.Recommendation;
        eval.RecommendationOther = dto.Recommendation == "Other" ? dto.RecommendationOther?.Trim() : null;
        eval.OverallRating = dto.OverallRating;
        eval.UpdatedAt = DateTime.UtcNow;

        if (eval.Items.Count > 0) db.InterviewEvaluationItems.RemoveRange(eval.Items);
        eval.Items = (dto.Items ?? [])
            .Where(it => it.Rating is not null || !string.IsNullOrWhiteSpace(it.Comment))
            .Select(it => new InterviewEvaluationItem
            {
                CriterionKey = it.CriterionKey,
                Rating = it.Rating,
                Comment = string.IsNullOrWhiteSpace(it.Comment) ? null : it.Comment.Trim(),
            })
            .ToList();

        if (dto.Submit)
        {
            eval.IsSubmitted = true;
            eval.SubmittedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        var name = eval.InterviewerUser?.Name
                   ?? await db.Users.Where(u => u.Id == userId).Select(u => u.Name).FirstOrDefaultAsync()
                   ?? "Unknown";

        // The Candidate include is guaranteed by the required FK; the pattern keeps the compiler's
        // nullable analysis happy, matching how the rubric lookup above treats the navigation.
        if (dto.Submit && interview.Candidate is { } candidate)
            await NotifyEvaluationSubmittedAsync(candidate, userId, name);

        return (ToDto(eval, name), null, false, false);
    }

    /// <summary>
    /// Tells the people who act on evaluations that one has landed: every active Admin+, plus the
    /// active Recruiters who can see this candidate. The recruiter scope mirrors
    /// <c>CandidateService.ApplyAccess</c> on purpose - the notification links to the candidate's
    /// evaluation report, which is owner-scoped for recruiters, so a wider fan-out would hand the
    /// rest of them a dead link. The submitter is skipped: an Admin may also be the interviewer.
    /// </summary>
    private async Task NotifyEvaluationSubmittedAsync(Candidate candidate, int submitterUserId, string submitterName)
    {
        var assignedRecruiterIds = candidate.RoleAppliedOptionId is int roleOptionId
            ? await db.RoleAppliedOptions
                .Where(o => o.Id == roleOptionId)
                .SelectMany(o => o.Recruiters.Select(r => r.UserId))
                .ToListAsync()
            : [];

        var recipientIds = await db.Users
            .Where(u => u.IsActive && u.Id != submitterUserId)
            .Where(u => u.Roles.Any(r => r.Role == Roles.SuperAdmin || r.Role == Roles.Admin) ||
                        (u.Roles.Any(r => r.Role == Roles.Recruiter) &&
                         (candidate.OwnerUserId == u.Id || assignedRecruiterIds.Contains(u.Id))))
            .Select(u => u.Id)
            .ToListAsync();

        foreach (var recipientId in recipientIds)
            await notificationService.NotifyAsync(
                recipientId,
                "Evaluation submitted",
                $"{submitterName} submitted an interview evaluation for {candidate.FullName}.",
                $"/candidates/{candidate.Id}/evaluations",
                category: NotificationCategories.EvaluationSubmitted);
    }

    private static InterviewEvaluationDto ToDto(InterviewEvaluation e) =>
        ToDto(e, e.InterviewerUser?.Name ?? "Unknown");

    private static InterviewEvaluationDto ToDto(InterviewEvaluation e, string interviewerName) => new(
        e.Id,
        e.InterviewerUserId,
        interviewerName,
        e.GeneralAssessment,
        e.Recommendation,
        e.RecommendationOther,
        e.OverallRating,
        e.IsSubmitted,
        e.SubmittedAt,
        e.Items.Select(it => new EvaluationItemDto(it.CriterionKey, it.Rating, it.Comment)).ToList());
}
