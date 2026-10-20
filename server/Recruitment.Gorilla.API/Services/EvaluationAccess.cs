using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The one predicate behind every grantee read path (#184). A user may read the submitted
/// evaluations of an interview when:
///   an active grant covers it (candidate-wide, or naming that interview) and the grantee is active,
///   AND NOT (the user is an assigned interviewer on it who has not submitted their own evaluation),
///   and the interview is not cancelled.
/// The second clause is the same-interview peer rule from <c>InterviewService.GetDetailAsync</c>: a
/// grant never shows a colleague's verdict on an interview the user still has to evaluate themselves.
///
/// Grants are read as "does an active one exist", so a duplicate row (see the backlog note on
/// concurrent shares) changes nothing here. Nothing outside this class decides grantee access.
/// </summary>
public class EvaluationAccess(AppDbContext db)
{
    /// <summary>The client route a grantee opens to read what was shared with them (#186).</summary>
    public static string SharedReportLink(int candidateId) => $"/shared/candidates/{candidateId}/evaluations";

    /// <summary>Active grants for this user and candidate: not revoked, not expired, grantee still active.</summary>
    private IQueryable<Models.EvaluationAccessGrant> ActiveGrants(int userId, int candidateId, DateTime now) =>
        db.EvaluationAccessGrants.Where(g =>
            g.CandidateId == candidateId && g.GranteeUserId == userId
            && g.RevokedAt == null && (g.ExpiresAt == null || g.ExpiresAt > now)
            && g.GranteeUser.IsActive);

    /// <summary>True when the user holds any active grant on the candidate (profile and CV access).</summary>
    public Task<bool> HasActiveGrantAsync(int userId, int candidateId) =>
        ActiveGrants(userId, candidateId, DateTime.UtcNow).AnyAsync();

    /// <summary>Ids of this candidate's interviews whose submitted evaluations the user may read.</summary>
    public async Task<List<int>> VisibleInterviewIdsAsync(int userId, int candidateId)
    {
        var grantedInterviewIds = await ActiveGrants(userId, candidateId, DateTime.UtcNow)
            .Select(g => g.InterviewId)
            .ToListAsync();
        if (grantedInterviewIds.Count == 0) return [];

        var candidateWide = grantedInterviewIds.Any(id => id is null);
        var interviews = await db.Interviews
            .Where(i => i.CandidateId == candidateId && i.Status != Models.InterviewStatuses.Cancelled)
            .Select(i => new
            {
                i.Id,
                Assigned = i.Interviewers.Any(ii => ii.UserId == userId),
                Submitted = i.Evaluations.Any(e => e.InterviewerUserId == userId && e.IsSubmitted),
            })
            .ToListAsync();

        return interviews
            .Where(i => candidateWide || grantedInterviewIds.Contains(i.Id))
            .Where(i => !(i.Assigned && !i.Submitted))
            .Select(i => i.Id)
            .ToList();
    }

    public async Task<bool> CanSeeInterviewAsync(int userId, int interviewId)
    {
        var candidateId = await db.Interviews
            .Where(i => i.Id == interviewId)
            .Select(i => (int?)i.CandidateId)
            .FirstOrDefaultAsync();
        return candidateId is int id && (await VisibleInterviewIdsAsync(userId, id)).Contains(interviewId);
    }

    /// <summary>
    /// Grantees who can read the evaluations of this interview right now, for the submit fan-out.
    /// Runs the same predicate per person, so it cannot drift from what the read endpoints allow.
    /// </summary>
    public async Task<List<int>> GranteeIdsForInterviewAsync(int interviewId, int excludeUserId)
    {
        var interview = await db.Interviews
            .Where(i => i.Id == interviewId)
            .Select(i => new { i.CandidateId })
            .FirstOrDefaultAsync();
        if (interview is null) return [];

        var now = DateTime.UtcNow;
        var candidates = await db.EvaluationAccessGrants
            .Where(g => g.CandidateId == interview.CandidateId && g.GranteeUserId != excludeUserId
                        && g.RevokedAt == null && (g.ExpiresAt == null || g.ExpiresAt > now)
                        && (g.InterviewId == null || g.InterviewId == interviewId)
                        && g.GranteeUser.IsActive)
            .Select(g => g.GranteeUserId)
            .Distinct()
            .ToListAsync();

        var allowed = new List<int>();
        foreach (var userId in candidates)
            if (await CanSeeInterviewAsync(userId, interviewId)) allowed.Add(userId);
        return allowed;
    }

    /// <summary>
    /// What has been shared with this user: one entry per candidate, merged across their active
    /// grants, newest grant first. Revoked, expired and deactivated-grantee grants never appear.
    /// </summary>
    public async Task<List<SharedEvaluationSummaryDto>> SharedWithMeAsync(int userId)
    {
        var now = DateTime.UtcNow;
        var grants = await db.EvaluationAccessGrants
            .AsNoTracking()
            .Where(g => g.GranteeUserId == userId && g.RevokedAt == null
                        && (g.ExpiresAt == null || g.ExpiresAt > now) && g.GranteeUser.IsActive)
            .Include(g => g.Candidate).ThenInclude(c => c.RoleAppliedOption)
            .Include(g => g.GrantedByUser)
            .Include(g => g.Interview)
            .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id)
            .ToListAsync();

        var result = new List<SharedEvaluationSummaryDto>();
        foreach (var byCandidate in grants.GroupBy(g => g.CandidateId))
        {
            var newest = byCandidate.First();
            var candidate = newest.Candidate;
            var visibleIds = await VisibleInterviewIdsAsync(userId, candidate.Id);
            var visibleCount = await db.InterviewEvaluations
                .CountAsync(e => e.IsSubmitted && visibleIds.Contains(e.InterviewId));

            var allRounds = byCandidate.Any(g => g.InterviewId is null);
            var interviews = allRounds
                ? []
                : byCandidate.Where(g => g.Interview is not null)
                    .Select(g => g.Interview!)
                    .DistinctBy(i => i.Id)
                    .OrderBy(i => i.ScheduledAt)
                    .Select(i => new SharedInterviewDto(i.Id, i.ScheduledAt))
                    .ToList();
            var expiresAt = byCandidate.Any(g => g.ExpiresAt is null) ? (DateTime?)null : byCandidate.Max(g => g.ExpiresAt);

            result.Add(new SharedEvaluationSummaryDto(
                candidate.Id, candidate.FullName,
                candidate.RoleAppliedOption?.Name ?? candidate.AppliedRole,
                allRounds, interviews, newest.GrantedByUser?.Name, newest.Note, expiresAt, visibleCount));
        }
        return result;
    }
}
