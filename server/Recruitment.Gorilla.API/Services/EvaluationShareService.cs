using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public enum RevokeShareResult { Revoked, NotFound, AutoManaged }

/// <summary>
/// Grants and revokes read access to a candidate's submitted interview evaluations (#182, phase 1).
/// This service only manages the grants: nothing reads them yet, so creating one changes no one's
/// access until the grantee read path (#184) exists.
///
/// The caller is responsible for the grantor's own authority over the candidate (a Recruiter is limited
/// to candidates in their scope; the controller resolves that and answers 404 before calling here).
/// </summary>
public class EvaluationShareService(AppDbContext db, NotificationService notifications, AuditService audit)
{
    public const int MaxGranteesPerRequest = 20;
    public const int MaxNoteLength = 500;
    public const int MaxInterviewsPerRequest = 50;
    private const int MaxNotificationMessageLength = 500;

    public async Task<List<EvaluationShareDto>> ListAsync(int candidateId)
    {
        var now = DateTime.UtcNow;
        var grants = await db.EvaluationAccessGrants
            .AsNoTracking()
            .Where(g => g.CandidateId == candidateId)
            .Include(g => g.GranteeUser)
            .Include(g => g.GrantedByUser)
            .Include(g => g.RevokedByUser)
            .Include(g => g.Interview)
            .OrderByDescending(g => g.CreatedAt).ThenByDescending(g => g.Id)
            .ToListAsync();

        return grants.Select(g => ToDto(g, now)).ToList();
    }

    /// <summary>
    /// What the share drawer offers for a candidate: its non-cancelled interviews (date, type tags,
    /// panel) and every active user, flagged when they already read everything (the same rule that
    /// makes <see cref="CreateAsync"/> skip them). Null when the candidate does not exist; the caller
    /// has already applied the candidate scope.
    /// </summary>
    public async Task<ShareOptionsDto?> GetOptionsAsync(int candidateId)
    {
        var candidate = await db.Candidates
            .Include(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(c => c.Id == candidateId);
        if (candidate is null) return null;

        var interviews = await db.Interviews
            .AsNoTracking()
            .Where(i => i.CandidateId == candidateId && i.Status != InterviewStatuses.Cancelled)
            .Include(i => i.Tags).ThenInclude(t => t.InterviewTypeOption)
            .Include(i => i.Interviewers).ThenInclude(ii => ii.User)
            .OrderBy(i => i.ScheduledAt)
            .ToListAsync();

        var users = await db.Users
            .AsNoTracking()
            .Include(u => u.Roles)
            .Where(u => u.IsActive)
            .OrderBy(u => u.Name)
            .ToListAsync();

        var evaluatedRounds = await db.Interviews
            .CountAsync(i => i.CandidateId == candidateId && i.Status != InterviewStatuses.Cancelled
                             && i.Evaluations.Any(e => e.IsSubmitted));

        return new ShareOptionsDto(
            interviews.Select(i => new ShareOptionInterviewDto(
                i.Id, i.ScheduledAt, i.Status,
                i.Tags.Select(t => t.InterviewTypeOption.Name).OrderBy(n => n).ToList(),
                i.Interviewers.Select(ii => ii.User.Name).OrderBy(n => n).ToList())).ToList(),
            users.Select(u =>
            {
                var reason = FullAccessReason(u, candidate);
                return new ShareOptionUserDto(u.Id, u.Name, u.Email, reason is not null, reason);
            }).ToList(),
            evaluatedRounds);
    }

    /// <summary>
    /// Creates (or refreshes) grants. All validation runs first and a failure writes nothing, so a
    /// request is all-or-nothing. A person who can already read every evaluation of this candidate (an
    /// Admin, or a Recruiter who owns the candidate or is assigned to its job opening) is skipped and
    /// reported rather than stored.
    /// </summary>
    public async Task<(CreateEvaluationSharesResultDto? Result, string? Error)> CreateAsync(
        int candidateId, CreateEvaluationSharesDto dto, int grantorUserId, string grantorName)
    {
        var now = DateTime.UtcNow;

        var candidate = await db.Candidates
            .Include(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(c => c.Id == candidateId);
        if (candidate is null) return (null, "Candidate not found.");

        // ---- validate everything before writing anything ----
        var granteeIds = (dto.GranteeUserIds ?? []).Distinct().ToList();
        if (granteeIds.Count == 0) return (null, "Choose at least one person to share with.");
        if (granteeIds.Count > MaxGranteesPerRequest)
            return (null, $"Share with at most {MaxGranteesPerRequest} people at a time.");

        var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
        if (note is { Length: > MaxNoteLength }) return (null, $"The note can be at most {MaxNoteLength} characters.");

        DateTime? expiresAt = null;
        if (dto.ExpiresAt is DateTime requested)
        {
            // An unspecified kind is read as UTC, matching how the rest of the API stores dates.
            expiresAt = requested.Kind == DateTimeKind.Local ? requested.ToUniversalTime()
                : DateTime.SpecifyKind(requested, DateTimeKind.Utc);
            if (expiresAt <= now) return (null, "The expiry must be in the future.");
        }

        var grantees = await db.Users.Include(u => u.Roles).Where(u => granteeIds.Contains(u.Id)).ToListAsync();
        if (grantees.Count != granteeIds.Count || grantees.Any(u => !u.IsActive))
            return (null, "Every person must be an existing, active user.");

        var interviewIds = (dto.InterviewIds ?? []).Distinct().ToList();
        if (interviewIds.Count > MaxInterviewsPerRequest)
            return (null, $"Choose at most {MaxInterviewsPerRequest} interviews at a time.");
        if (interviewIds.Count > 0)
        {
            var interviews = await db.Interviews
                .Where(i => interviewIds.Contains(i.Id))
                .Select(i => new { i.Id, i.CandidateId, i.Status })
                .ToListAsync();
            if (interviews.Count != interviewIds.Count
                || interviews.Any(i => i.CandidateId != candidateId || i.Status == InterviewStatuses.Cancelled))
                return (null, "Choose interviews that belong to this candidate and have not been cancelled.");
        }

        // ---- who already reads everything? ----
        var skipped = new List<SkippedGranteeDto>();
        var targets = new List<User>();
        foreach (var user in grantees.OrderBy(u => granteeIds.IndexOf(u.Id)))
        {
            var reason = FullAccessReason(user, candidate);
            if (reason is null) targets.Add(user);
            else skipped.Add(new SkippedGranteeDto(user.Id, user.Name, reason));
        }

        // ---- write ----
        var touched = new List<EvaluationAccessGrant>();
        var created = new List<EvaluationAccessGrant>();
        var refreshed = new List<(EvaluationAccessGrant Grant, DateTime? OldExpiresAt, string? OldNote)>();
        var newlyNotified = new List<User>();
        foreach (var user in targets)
        {
            var anyNew = false;
            // One candidate-wide row, or one row per interview.
            foreach (var interviewId in interviewIds.Count == 0 ? [(int?)null] : interviewIds.Select(i => (int?)i))
            {
                var existing = await db.EvaluationAccessGrants.FirstOrDefaultAsync(g =>
                    g.CandidateId == candidateId && g.InterviewId == interviewId && g.GranteeUserId == user.Id
                    && g.Source == EvaluationAccessGrant.ManualSource // never take over a booking's automatic grant
                    && g.RevokedAt == null && (g.ExpiresAt == null || g.ExpiresAt > now));

                if (existing is not null)
                {
                    // Re-granting the same thing refreshes it instead of stacking a duplicate.
                    refreshed.Add((existing, existing.ExpiresAt, existing.Note));
                    // Leaving the expiry or note out keeps what is there; it never clears it silently.
                    if (note is not null) existing.Note = note;
                    if (expiresAt is not null) existing.ExpiresAt = expiresAt;
                    touched.Add(existing);
                    continue;
                }

                var grant = new EvaluationAccessGrant
                {
                    CandidateId = candidateId,
                    InterviewId = interviewId,
                    GranteeUserId = user.Id,
                    GrantedByUserId = grantorUserId,
                    Source = EvaluationAccessGrant.ManualSource,
                    Note = note,
                    ExpiresAt = expiresAt,
                    CreatedAt = now,
                };
                db.EvaluationAccessGrants.Add(grant);
                touched.Add(grant);
                created.Add(grant);
                anyNew = true;
            }
            if (anyNew) newlyNotified.Add(user);
        }
        await db.SaveChangesAsync();

        // Only genuinely new grants are audited as granted; a refresh keeps its original entry.
        foreach (var grant in created)
        {
            var scope = grant.InterviewId is int iid ? $"interview #{iid}" : "all rounds";
            var who = targets.First(u => u.Id == grant.GranteeUserId).Name;
            await audit.RecordAsync("EvaluationShare.Granted", "Candidate", candidateId,
                $"Shared evaluations of candidate #{candidateId} ({scope}) with {who}");
        }

        foreach (var (grant, oldExpiry, oldNote) in refreshed.Where(r => r.OldExpiresAt != r.Grant.ExpiresAt || r.OldNote != r.Grant.Note))
        {
            var who = targets.First(u => u.Id == grant.GranteeUserId).Name;
            await audit.RecordAsync("EvaluationShare.Updated", "Candidate", candidateId,
                $"Updated share of candidate #{candidateId} with {who}: expiry {oldExpiry?.ToString("u") ?? "none"} to {grant.ExpiresAt?.ToString("u") ?? "none"}");
        }

        foreach (var user in newlyNotified)
            await NotifyGranteeAsync(user, grantorName, candidate.Id, candidate.FullName, note);

        var dtos = await ListAsync(candidateId);
        var touchedIds = touched.Select(g => g.Id).ToHashSet();
        return (new CreateEvaluationSharesResultDto(dtos.Where(d => touchedIds.Contains(d.Id)).ToList(), skipped), null);
    }

    /// <summary>
    /// Soft revoke: the row stays for audit. A share that is not this candidate's is NotFound, checked
    /// before anything is written. Revoking an already revoked share is a no-op that keeps the first
    /// revocation.
    /// </summary>
    public async Task<RevokeShareResult> RevokeAsync(int candidateId, int shareId, int actorUserId, string actorName)
    {
        var grant = await db.EvaluationAccessGrants
            .Include(g => g.GranteeUser)
            .FirstOrDefaultAsync(g => g.Id == shareId && g.CandidateId == candidateId);
        if (grant is null) return RevokeShareResult.NotFound;
        if (grant.RevokedAt is not null) return RevokeShareResult.Revoked;
        // A booking's automatic grant follows its panel, so a hand revoke would just be undone by the next
        // reschedule. The recruiter changes the panel or turns the booking's setting off instead.
        if (grant.Source == EvaluationAccessGrant.PanelAutoShareSource) return RevokeShareResult.AutoManaged;

        grant.RevokedAt = DateTime.UtcNow;
        grant.RevokedByUserId = actorUserId;
        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationShare.Revoked", "Candidate", candidateId,
            $"Stopped sharing evaluations of candidate #{candidateId} with {grant.GranteeUser.Name}");
        return RevokeShareResult.Revoked;
    }

    /// <summary>Why this user already reads every evaluation of the candidate, or null if a grant would add access.</summary>
    public static string? FullAccessReason(User user, Candidate candidate)
    {
        var roles = user.Roles.Select(r => r.Role).ToList();
        if (roles.Contains(Roles.SuperAdmin) || roles.Contains(Roles.Admin))
            return "Already has access to every evaluation (Admin).";

        if (roles.Contains(Roles.Recruiter)
            && (candidate.OwnerUserId == user.Id
                || (candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == user.Id) ?? false)))
            return "Already has access as this candidate's recruiter.";

        return null;
    }

    private Task NotifyGranteeAsync(User grantee, string grantorName, int candidateId, string candidateName, string? note)
    {
        // The notification message column holds 500 characters and a note can be 500 on its own, so the
        // in-app text is cut to fit; the full note stays on the grant and in the email.
        var message = Truncate(
            $"{grantorName} shared the submitted interview evaluations for {candidateName} with you."
            + (note is null ? "" : $" Note: {note}"),
            MaxNotificationMessageLength);
        var (subject, html) = EmailTemplates.EvaluationShared(grantee.Name, grantorName, candidateName, note);
        return notifications.NotifyAsync(
            grantee.Id, "Interview evaluations shared with you", message, linkUrl: EvaluationAccess.SharedReportLink(candidateId),
            emailSubject: subject, emailHtmlBody: html, category: NotificationCategories.EvaluationShared);
    }

    private static string Truncate(string text, int max) =>
        text.Length <= max ? text : string.Concat(text.AsSpan(0, max - 1), "…");

    private static EvaluationShareDto ToDto(EvaluationAccessGrant g, DateTime now) => new(
        g.Id, g.CandidateId, g.InterviewId, g.Interview?.ScheduledAt,
        g.GranteeUserId, g.GranteeUser.Name, g.GranteeUser.Email,
        g.Source, g.Note, g.ExpiresAt, g.IsActive(now),
        g.GrantedByUserId, g.GrantedByUser?.Name,
        g.CreatedAt, g.RevokedAt, g.RevokedByUserId, g.RevokedByUser?.Name);
}
