using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Keeps the <c>PanelAutoShare</c> grants of one booking in step with it (#187). With
/// <see cref="Interview.ShareEarlierRoundsWithPanel"/> on, each panelist holds one interview-specific
/// grant per earlier non-cancelled round of the candidate, created for this interview; with it off, or
/// when a panelist leaves or the interview is cancelled, those grants are soft revoked.
///
/// Only grants with that source and <c>CreatedForInterviewId</c> are ever revoked, so a manual share is
/// never touched. Panelists who already read everything (Admin+, the candidate's recruiters) or whose
/// existing active grant already covers a round get nothing extra. Safe to call repeatedly: it only
/// adds what is missing and removes what no longer belongs.
/// </summary>
public class PanelAutoShareService(AppDbContext db, AuditService audit)
{
    /// <summary>
    /// Brings the booking's auto grants in line with <paramref name="panelIds"/> and the flag. Pass an
    /// empty panel (or <paramref name="enabled"/> false) to revoke them all. Returns the users who hold
    /// an active auto grant for this interview afterwards.
    /// </summary>
    public async Task<List<int>> SyncAsync(
        Interview interview, IReadOnlyCollection<int> panelIds, bool enabled, int? actorUserId)
    {
        var now = DateTime.UtcNow;
        var candidateId = interview.CandidateId;

        var existing = await db.EvaluationAccessGrants
            .Where(g => g.Source == EvaluationAccessGrant.PanelAutoShareSource
                        && g.CreatedForInterviewId == interview.Id && g.RevokedAt == null)
            .Include(g => g.GranteeUser)
            .ToListAsync();

        // What each panelist should hold: (grantee, earlier round) pairs.
        var wanted = new HashSet<(int UserId, int RoundId)>();
        var toCreate = new List<(User User, int RoundId)>();

        if (enabled && panelIds.Count > 0)
        {
            var candidate = await db.Candidates
                .Include(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
                .FirstAsync(c => c.Id == candidateId);
            var earlierRoundIds = await db.Interviews
                // Booked before this one and held before it: a round still to come must not be read by a
                // later panel, which is the anchoring the default is there to prevent.
                .Where(i => i.CandidateId == candidateId && i.Id < interview.Id
                            && i.ScheduledAt < interview.ScheduledAt
                            && i.Status != InterviewStatuses.Cancelled)
                .Select(i => i.Id)
                .ToListAsync();
            var panel = await db.Users.Include(u => u.Roles)
                .Where(u => panelIds.Contains(u.Id) && u.IsActive)
                .ToListAsync();

            // Active grants from elsewhere (manual, or another booking) that already cover a round.
            var others = await db.EvaluationAccessGrants
                .Where(g => g.CandidateId == candidateId && panelIds.Contains(g.GranteeUserId)
                            && g.RevokedAt == null && (g.ExpiresAt == null || g.ExpiresAt > now)
                            && !(g.Source == EvaluationAccessGrant.PanelAutoShareSource
                                 && g.CreatedForInterviewId == interview.Id))
                .Select(g => new { g.GranteeUserId, g.InterviewId })
                .ToListAsync();

            foreach (var user in panel)
            {
                if (EvaluationShareService.FullAccessReason(user, candidate) is not null) continue;
                foreach (var roundId in earlierRoundIds)
                {
                    var covered = others.Any(o =>
                        o.GranteeUserId == user.Id && (o.InterviewId is null || o.InterviewId == roundId));
                    if (covered) continue;
                    wanted.Add((user.Id, roundId));
                    if (!existing.Any(g => g.GranteeUserId == user.Id && g.InterviewId == roundId))
                        toCreate.Add((user, roundId));
                }
            }
        }

        var toRevoke = existing.Where(g => !wanted.Contains((g.GranteeUserId, g.InterviewId ?? 0))).ToList();
        if (toCreate.Count == 0 && toRevoke.Count == 0)
            return existing.Select(g => g.GranteeUserId).Distinct().ToList();

        foreach (var (user, roundId) in toCreate)
            db.EvaluationAccessGrants.Add(new EvaluationAccessGrant
            {
                CandidateId = candidateId,
                InterviewId = roundId,
                GranteeUserId = user.Id,
                GrantedByUserId = actorUserId,
                Source = EvaluationAccessGrant.PanelAutoShareSource,
                CreatedForInterviewId = interview.Id,
                CreatedAt = now,
            });
        foreach (var grant in toRevoke)
        {
            grant.RevokedAt = now;
            grant.RevokedByUserId = actorUserId;
        }
        await db.SaveChangesAsync();

        foreach (var group in toCreate.GroupBy(c => c.User.Id))
            await audit.RecordAsync("EvaluationShare.Granted", "Candidate", candidateId,
                $"Shared earlier rounds of candidate #{candidateId} with {group.First().User.Name} (panel of interview #{interview.Id})",
                $"Interviews: {string.Join(", ", group.Select(c => $"#{c.RoundId}"))}");
        foreach (var group in toRevoke.GroupBy(g => g.GranteeUserId))
            await audit.RecordAsync("EvaluationShare.Revoked", "Candidate", candidateId,
                $"Stopped sharing earlier rounds of candidate #{candidateId} with {group.First().GranteeUser.Name} (interview #{interview.Id} changed)",
                $"Interviews: {string.Join(", ", group.Select(g => $"#{g.InterviewId}"))}");

        return await db.EvaluationAccessGrants
            .Where(g => g.Source == EvaluationAccessGrant.PanelAutoShareSource
                        && g.CreatedForInterviewId == interview.Id && g.RevokedAt == null)
            .Select(g => g.GranteeUserId)
            .Distinct()
            .ToListAsync();
    }
}
