using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
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
public class InterviewService(
    AppDbContext db, CandidateService candidateService, NotificationService notificationService,
    AuditService audit, IConfiguration config, PanelAutoShareService panelAutoShare,
    IEmailSettingsResolver? emailSettings = null)
{
    private const string InterviewScheduledStatus = "Interview Scheduled";
    private const string CallForInterviewStatus = "Call for Interview";

    private readonly EvaluationAccess evaluationAccess = new(db);

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
            .Where(i => i.Status != InterviewStatuses.Cancelled)
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
            // Nobody evaluates a cancelled interview, so the page offers no form for it (#189).
            isAssigned && interview.Status != InterviewStatuses.Cancelled,
            myEval is null ? null : ToDto(myEval), allEvals,
            interview.Notes ?? interview.StatusHistory?.Comment, tags, interview.DurationMinutes,
            interview.Status);
    }

    /// <summary>
    /// A candidate's evaluation report: every interviewer's full (submitted) rubric across all the
    /// candidate's interviews, plus aggregates (average overall, per-criterion averages,
    /// recommendation tally). Access is candidate-scoped via <paramref name="ownerScope"/>
    /// (recruiters only see their accessible candidates); returns null when not accessible.
    /// <paramref name="onlyInterviewIds"/> narrows the report (and so its aggregates) to those
    /// interviews; the grantee endpoints pass what the access predicate allows (#184).
    /// </summary>
    public async Task<CandidateEvaluationReportDto?> GetCandidateEvaluationReportAsync(
        int candidateId, int? ownerScope, IReadOnlyCollection<int>? onlyInterviewIds = null)
    {
        // Reuse the candidate access predicate (owned OR assigned-role; Admin+ = null scope).
        var candidate = await candidateService.GetByIdAsync(candidateId, ownerScope);
        if (candidate is null) return null;

        var interviews = await db.Interviews
            // A cancelled interview never happened, so anything already submitted on it does not count (#189).
            .Where(i => i.CandidateId == candidateId && i.Status != InterviewStatuses.Cancelled)
            .Where(i => onlyInterviewIds == null || onlyInterviewIds.Contains(i.Id))
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

        // A cancelled interview never happened: nothing may be saved or submitted on it (#189). Checked
        // before anything is read or written, so a refused save leaves no row and sends no notification.
        if (interview.Status == InterviewStatuses.Cancelled)
            return (null, "This interview was cancelled.", false, true);

        // The same rubric the interview page shows (#188). With no rubric at all, the built-in catalogue.
        var rubric = await EvaluationRubricService.ResolveAsync(
            db, interview.Candidate?.RoleAppliedOptionId, interview.Candidate?.AppliedRole);
        HashSet<string> validKeys = rubric is { Criteria.Count: > 0 }
            ? rubric.Criteria.Select(c => c.Key).ToHashSet()
            : EvaluationCriteria.Keys.ToHashSet();

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
            await NotifyEvaluationSubmittedAsync(candidate, interview.Id, userId, name);

        return (ToDto(eval, name), null, false, false);
    }

    /// <summary>
    /// Tells the people who act on evaluations that one has landed: every active Admin+, plus the
    /// active Recruiters who can see this candidate. The recruiter scope mirrors
    /// <c>CandidateService.ApplyAccess</c> on purpose - the notification links to the candidate's
    /// evaluation report, which is owner-scoped for recruiters, so a wider fan-out would hand the
    /// rest of them a dead link. The submitter is skipped: an Admin may also be the interviewer.
    /// Grantees whose grant covers this interview and who pass the access predicate hear too (#184),
    /// linking to the shared report.
    /// </summary>
    private async Task NotifyEvaluationSubmittedAsync(
        Candidate candidate, int interviewId, int submitterUserId, string submitterName)
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

        // Someone who is both a grantee and already in the list above is told once, by the link they can open.
        var granteeIds = await evaluationAccess.GranteeIdsForInterviewAsync(interviewId, submitterUserId);
        foreach (var granteeId in granteeIds.Except(recipientIds))
            await notificationService.NotifyAsync(
                granteeId,
                "Evaluation submitted",
                $"{submitterName} submitted an interview evaluation for {candidate.FullName}.",
                EvaluationAccess.SharedReportLink(candidate.Id),
                category: NotificationCategories.EvaluationSubmitted);
    }


    // ----- Reschedule / cancel (issue #173) -----

    /// <summary>
    /// Narrow read model for the edit form. Deliberately not <see cref="GetDetailAsync"/>, which is
    /// gated on being an assigned interviewer or Admin+ and would 404 the recruiter who owns the
    /// candidate. Owner-scoped instead, so it answers exactly the people allowed to edit.
    /// </summary>
    public async Task<(InterviewScheduleDto? Dto, string? Error, bool NotFound, bool Conflict)> GetScheduleAsync(
        int id, int? ownerScope)
    {
        var interview = await LoadForScheduleAsync(id);
        if (interview is null) return (null, null, true, false);

        var candidate = await candidateService.GetByIdAsync(interview.CandidateId, ownerScope);
        if (candidate is null) return (null, null, true, false);

        return (ToScheduleDto(interview, candidate.FullName), null, false, false);
    }

    /// <summary>
    /// Moves a booking in place: time, duration, interviewers, types and notes. Writes no
    /// <see cref="StatusHistory"/> row - that table means "the candidate's status became X at
    /// time T", and a reschedule changes neither the status nor the time it was reached.
    /// </summary>
    public async Task<(InterviewScheduleDto? Dto, string? Error, bool NotFound, bool Conflict)> RescheduleAsync(
        int id, RescheduleInterviewDto dto, int? ownerScope, int actorUserId, string actorName)
    {
        var interview = await LoadForScheduleAsync(id);
        if (interview is null) return (null, null, true, false);

        var candidate = await candidateService.GetByIdAsync(interview.CandidateId, ownerScope);
        if (candidate is null) return (null, null, true, false);

        var roleLockError = await candidateService.GetRoleLockErrorAsync(interview.CandidateId);
        if (roleLockError is not null) return (null, roleLockError, false, false);

        if (interview.Status == InterviewStatuses.Cancelled)
            return (null, "This interview has been cancelled. Book a new one from Call for Interview.", false, true);

        if (interview.Evaluations.Any(e => e.IsSubmitted))
            return (null, "This interview already has a submitted evaluation, so it has taken place. " +
                          "Move the candidate to Interview Completed and schedule another round instead.", false, true);

        // Past Interview Scheduled covers Rejected and Discontinued too: there is nothing to move.
        if (candidate.CurrentStatus != InterviewScheduledStatus)
            return (null, $"The candidate is now at \"{candidate.CurrentStatus}\", so this interview can no longer be moved.", false, true);

        var scheduledAt = dto.ScheduledAt.ToUniversalTime();
        if (scheduledAt <= DateTime.UtcNow)
            return (null, "Pick a time in the future.", false, false);

        var newInterviewerIds = (dto.InterviewerUserIds ?? []).Distinct().ToList();
        if (newInterviewerIds.Count == 0)
            return (null, "Assign at least one interviewer.", false, false);

        var activeCount = await db.Users
            .CountAsync(u => u.IsActive && newInterviewerIds.Contains(u.Id));
        if (activeCount != newInterviewerIds.Count)
            return (null, "One of the selected interviewers is not an active user.", false, false);

        var notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
        if (notes?.Length > 4000)
            return (null, "Interview notes cannot exceed 4000 characters.", false, false);

        var reason = string.IsNullOrWhiteSpace(dto.Reason) ? null : dto.Reason.Trim();
        if (reason?.Length > 1000)
            return (null, "The reason cannot exceed 1000 characters.", false, false);

        var newTagIds = (dto.InterviewTypeOptionIds ?? []).Distinct().ToList();
        if (newTagIds.Count > 0)
        {
            var validTagCount = await db.InterviewTypeOptions
                .CountAsync(t => t.IsActive && newTagIds.Contains(t.Id));
            if (validTagCount != newTagIds.Count)
                return (null, "One or more selected interview types are not valid active options.", false, false);
        }

        var oldInterviewerIds = interview.Interviewers.Select(ii => ii.UserId).ToList();
        var removedIds = oldInterviewerIds.Except(newInterviewerIds).ToList();
        var addedIds = newInterviewerIds.Except(oldInterviewerIds).ToList();
        var retainedIds = oldInterviewerIds.Intersect(newInterviewerIds).ToList();

        // Defence in depth: the submitted-evaluation check above already refuses the whole
        // reschedule, so this cannot currently fire. It stays because dropping an interviewer who
        // has submitted would strand an evaluation the candidate's report still aggregates, and
        // that must not become possible if the rule above is ever relaxed.
        if (removedIds.Any(uid => interview.Evaluations.Any(e => e.InterviewerUserId == uid && e.IsSubmitted)))
            return (null, "An interviewer who has already submitted an evaluation cannot be removed.", false, false);

        var previousScheduledAt = interview.ScheduledAt;
        var previousShareEarlier = interview.ShareEarlierRoundsWithPanel;

        // The booking and its earlier-rounds grants change together or not at all (#187).
        await using var tx = await BeginIfNoneAsync();

        // The cascade runs from Interview, not from the join row, so a dropped interviewer's draft
        // would survive and reappear the moment they were re-added. Delete it explicitly.
        var droppedDrafts = interview.Evaluations
            .Where(e => removedIds.Contains(e.InterviewerUserId) && !e.IsSubmitted)
            .ToList();
        if (droppedDrafts.Count > 0) db.InterviewEvaluations.RemoveRange(droppedDrafts);

        foreach (var removed in interview.Interviewers.Where(ii => removedIds.Contains(ii.UserId)).ToList())
            interview.Interviewers.Remove(removed);
        foreach (var added in addedIds)
            interview.Interviewers.Add(new InterviewInterviewer { UserId = added });

        interview.Tags.Clear();
        foreach (var tagId in newTagIds)
            interview.Tags.Add(new InterviewTag { InterviewTypeOptionId = tagId });

        interview.ScheduledAt = scheduledAt;
        interview.DurationMinutes = dto.DurationMinutes <= 0 ? 60 : dto.DurationMinutes;
        interview.Notes = notes;
        interview.UpdatedAt = DateTime.UtcNow;
        interview.UpdatedByUserId = actorUserId;
        // Calendar clients ignore a re-issued invite for a known UID unless SEQUENCE has grown.
        interview.CalendarSequence += 1;
        // Null leaves the booking's earlier-rounds setting as it was (#187).
        if (dto.ShareEarlierRoundsWithPanel is bool shareEarlier) interview.ShareEarlierRoundsWithPanel = shareEarlier;

        db.InterviewEvents.Add(new InterviewEvent
        {
            InterviewId = interview.Id,
            EventType = InterviewEventTypes.Rescheduled,
            PreviousScheduledAt = previousScheduledAt,
            NewScheduledAt = scheduledAt,
            Reason = reason,
            ActorUserId = actorUserId,
            ActorName = actorName,
        });

        await db.SaveChangesAsync();

        await audit.RecordAsync(
            "Interview.Rescheduled", "Interview", interview.Id,
            $"Interview for {candidate.FullName} moved",
            $"From {previousScheduledAt:u} to {scheduledAt:u}." + (reason is null ? "" : $" Reason: {reason}")
            + (previousShareEarlier == interview.ShareEarlierRoundsWithPanel
                ? ""
                : $" Share earlier rounds with the panel: {previousShareEarlier} -> {interview.ShareEarlierRoundsWithPanel}."));

        // Panel changes and the toggle move the earlier-rounds grants with the booking (#187).
        var withEarlierRounds = await panelAutoShare.SyncAsync(
            interview, newInterviewerIds, interview.ShareEarlierRoundsWithPanel, actorUserId);
        if (tx is not null) await tx.CommitAsync();

        await NotifyRescheduledAsync(interview, candidate.FullName, candidate.RoleApplied ?? candidate.AppliedRole,
            previousScheduledAt, reason, retainedIds, addedIds, removedIds, actorUserId, withEarlierRounds);

        var fresh = await LoadForScheduleAsync(id);
        return (ToScheduleDto(fresh!, candidate.FullName), null, false, false);
    }

    /// <summary>
    /// Cancels a booking. Unlike a reschedule this *does* move the candidate, back to Call for
    /// Interview, so the existing 2 -> 3 transition can book a fresh one. The cancelled row stays
    /// as history.
    /// </summary>
    public async Task<(InterviewScheduleDto? Dto, string? Error, bool NotFound, bool Conflict)> CancelAsync(
        int id, string? reason, int? ownerScope, int actorUserId, string actorName)
    {
        var interview = await LoadForScheduleAsync(id);
        if (interview is null) return (null, null, true, false);

        var candidate = await candidateService.GetByIdAsync(interview.CandidateId, ownerScope);
        if (candidate is null) return (null, null, true, false);

        var roleLockError = await candidateService.GetRoleLockErrorAsync(interview.CandidateId);
        if (roleLockError is not null) return (null, roleLockError, false, false);

        if (interview.Status == InterviewStatuses.Cancelled)
            return (null, "This interview has already been cancelled.", false, true);

        if (interview.Evaluations.Any(e => e.IsSubmitted))
            return (null, "This interview already has a submitted evaluation, so it has taken place " +
                          "and cannot be cancelled.", false, true);

        var trimmedReason = reason?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedReason))
            return (null, "A reason is required to cancel an interview.", false, false);
        if (trimmedReason.Length > 1000)
            return (null, "The reason cannot exceed 1000 characters.", false, false);

        var scheduledAt = interview.ScheduledAt;
        var recipientIds = interview.Interviewers.Select(ii => ii.UserId).ToList();

        // Cancelling and revoking the panel's earlier-rounds grants must not be split by a failure (#187).
        await using var tx = await BeginIfNoneAsync();

        interview.Status = InterviewStatuses.Cancelled;
        interview.UpdatedAt = DateTime.UtcNow;
        interview.UpdatedByUserId = actorUserId;
        interview.CalendarSequence += 1;

        db.InterviewEvents.Add(new InterviewEvent
        {
            InterviewId = interview.Id,
            EventType = InterviewEventTypes.Cancelled,
            PreviousScheduledAt = scheduledAt,
            NewScheduledAt = null,
            Reason = trimmedReason,
            ActorUserId = actorUserId,
            ActorName = actorName,
        });

        await db.SaveChangesAsync();

        // A cancelled booking no longer gives its panel the earlier rounds (#187).
        await panelAutoShare.SyncAsync(interview, [], false, actorUserId);
        if (tx is not null) await tx.CommitAsync();

        // Only step the candidate back when the cancelled booking is what they are currently on.
        // Cancelling a live invite for a Rejected or Discontinued candidate is calendar cleanup;
        // moving them to Call for Interview would silently un-reject them.
        if (candidate.CurrentStatus == InterviewScheduledStatus)
        {
            await candidateService.AddStatusAsync(
                interview.CandidateId,
                new StatusChangeDto(CallForInterviewStatus, Comment: $"Interview cancelled: {trimmedReason}"),
                actorName, actorUserId);
        }

        await audit.RecordAsync(
            "Interview.Cancelled", "Interview", interview.Id,
            $"Interview for {candidate.FullName} cancelled",
            $"Was scheduled for {scheduledAt:u}. Reason: {trimmedReason}");

        await NotifyCancelledAsync(interview, candidate.FullName, candidate.RoleApplied ?? candidate.AppliedRole,
            scheduledAt, trimmedReason, recipientIds, actorUserId, removedFromPanel: false);

        var fresh = await LoadForScheduleAsync(id);
        return (ToScheduleDto(fresh!, candidate.FullName), null, false, false);
    }

    /// <summary>
    /// Starts a transaction unless one is already open (a test wraps each case in one), so a booking change
    /// and its grant sync commit together.
    /// </summary>
    private async Task<IDbContextTransaction?> BeginIfNoneAsync() =>
        db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync() : null;

    private Task<Interview?> LoadForScheduleAsync(int id) =>
        db.Interviews
            .Include(i => i.Interviewers)
            .Include(i => i.Evaluations)
            .Include(i => i.Tags)
            .Include(i => i.Events)
            .Include(i => i.StatusHistory)
            .FirstOrDefaultAsync(i => i.Id == id);

    private static InterviewScheduleDto ToScheduleDto(Interview i, string candidateName) => new(
        i.Id,
        i.CandidateId,
        candidateName,
        i.Status,
        i.ScheduledAt,
        i.DurationMinutes,
        // Interviews booked before Interview.Notes existed kept the recruiter's note on the
        // status entry that created them, so fall back to it rather than backfilling.
        i.Notes ?? i.StatusHistory?.Comment,
        i.Interviewers.Select(ii => ii.UserId).OrderBy(x => x).ToList(),
        i.Tags.Select(t => t.InterviewTypeOptionId).OrderBy(x => x).ToList(),
        i.Evaluations.Any(e => e.IsSubmitted),
        i.Events.OrderBy(e => e.CreatedAt).Select(ToEventDto).ToList(),
        i.ShareEarlierRoundsWithPanel);

    private static InterviewEventDto ToEventDto(InterviewEvent e) => new(
        e.EventType, e.PreviousScheduledAt, e.NewScheduledAt, e.Reason, e.ActorName, e.CreatedAt);

    private string InterviewUrl(int interviewId) =>
        $"{config["App:ClientBaseUrl"]?.TrimEnd('/')}/interviews/{interviewId}";

    /// <summary>
    /// RFC 5545 requires an ORGANIZER on a METHOD:CANCEL and clients drop the message without one.
    /// Use the configured outbound From address so it matches the envelope sender.
    /// </summary>
    private async Task<string?> OrganizerEmailAsync()
    {
        if (emailSettings is null) return null;
        try
        {
            var options = await emailSettings.ResolveAsync();
            return string.IsNullOrWhiteSpace(options.Smtp.FromAddress) ? null : options.Smtp.FromAddress;
        }
        catch
        {
            // A misconfigured mail provider must not stop the interview being moved.
            return null;
        }
    }

    /// <summary>
    /// Each group hears the thing that is true for them: retained interviewers that it moved,
    /// new ones the normal assignment message, dropped ones that they are off the panel.
    /// </summary>
    private async Task NotifyRescheduledAsync(
        Interview interview, string candidateName, string? roleName, DateTime previousScheduledAt,
        string? reason, List<int> retainedIds, List<int> addedIds, List<int> removedIds, int actorUserId,
        List<int> withEarlierRounds)
    {
        var url = InterviewUrl(interview.Id);
        var invite = new InterviewInviteDetails(
            interview.Id, candidateName, roleName, interview.ScheduledAt, interview.DurationMinutes,
            url, interview.CalendarSequence);
        var calendar = CalendarInvite.Build(invite);

        foreach (var uid in retainedIds)
        {
            var name = await UserNameAsync(uid);
            var (subject, html) = EmailTemplates.InterviewRescheduled(
                name, candidateName, roleName, previousScheduledAt, interview.ScheduledAt, url, reason, invite);
            await notificationService.NotifyAsync(
                uid, "Interview moved", $"The interview with {candidateName} has been moved.",
                $"/interviews/{interview.Id}", subject, html, calendar,
                category: NotificationCategories.InterviewRescheduled);
        }

        foreach (var uid in addedIds)
        {
            var name = await UserNameAsync(uid);
            var hasEarlierRounds = withEarlierRounds.Contains(uid);
            var earlierRoundsUrl = hasEarlierRounds
                ? $"{config["App:ClientBaseUrl"]?.TrimEnd('/')}{EvaluationAccess.SharedReportLink(interview.CandidateId)}"
                : null;
            var (subject, html) = EmailTemplates.InterviewAssigned(
                name, candidateName, roleName, interview.ScheduledAt, url, invite, earlierRoundsUrl);
            await notificationService.NotifyAsync(
                uid, "Interview assigned",
                $"You have been assigned to interview {candidateName}."
                + (hasEarlierRounds ? " Earlier rounds' evaluations are available to you." : ""),
                $"/interviews/{interview.Id}", subject, html, calendar,
                category: NotificationCategories.InterviewAssigned);
        }

        if (removedIds.Count > 0)
            await NotifyCancelledAsync(interview, candidateName, roleName, previousScheduledAt,
                reason, removedIds, actorUserId, removedFromPanel: true);

        await NotifyBookerAsync(interview, candidateName, actorUserId,
            "Interview moved", $"{candidateName}'s interview was moved to {interview.ScheduledAt:dd MMM yyyy, HH:mm} UTC.");
    }

    private async Task NotifyCancelledAsync(
        Interview interview, string candidateName, string? roleName, DateTime scheduledAt,
        string? reason, List<int> recipientIds, int actorUserId, bool removedFromPanel)
    {
        var invite = new InterviewInviteDetails(
            interview.Id, candidateName, roleName, scheduledAt, interview.DurationMinutes,
            InterviewUrl(interview.Id), interview.CalendarSequence, await OrganizerEmailAsync());
        var calendar = CalendarInvite.Build(invite, cancelled: true);

        foreach (var uid in recipientIds)
        {
            var name = await UserNameAsync(uid);
            var (subject, html) = EmailTemplates.InterviewCancelled(
                name, candidateName, roleName, scheduledAt, reason, removedFromPanel);
            await notificationService.NotifyAsync(
                uid,
                removedFromPanel ? "Removed from interview" : "Interview cancelled",
                removedFromPanel
                    ? $"You are no longer on the panel for {candidateName}."
                    : $"The interview with {candidateName} has been cancelled.",
                removedFromPanel ? null : $"/interviews/{interview.Id}",
                subject, html, calendar,
                category: NotificationCategories.InterviewCancelled);
        }

        if (!removedFromPanel)
            await NotifyBookerAsync(interview, candidateName, actorUserId,
                "Interview cancelled", $"{candidateName}'s interview was cancelled.");
    }

    /// <summary>
    /// The recruiter who booked it should not hear about the change from the candidate. Skipped
    /// when they are the one making it, and when they are already an interviewer being told.
    /// </summary>
    private async Task NotifyBookerAsync(Interview interview, string candidateName, int actorUserId, string title, string message)
    {
        if (interview.CreatedByUserId is not int bookerId || bookerId == actorUserId) return;
        if (interview.Interviewers.Any(ii => ii.UserId == bookerId)) return;

        await notificationService.NotifyAsync(
            bookerId, title, message, $"/candidates/{interview.CandidateId}");
    }

    private async Task<string> UserNameAsync(int userId) =>
        await db.Users.Where(u => u.Id == userId).Select(u => u.Name).FirstOrDefaultAsync() ?? "there";

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
