using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// The rule for an interview time that has already passed (#263). Only a Recruiter or Super Admin may use one, it
/// needs a reason, and it cannot reach back past when the candidate was added or the status the interview follows.
/// A future time is not this rule's business and always passes.
/// </summary>
public static class BackdatedInterview
{
    public const string FutureOnlyError = "Pick a time in the future.";
    public const string ReasonRequiredError = "A reason is required when the interview time is in the past.";

    /// <summary>Null when the time is acceptable, otherwise the message to show.</summary>
    public static string? Check(
        DateTime scheduledAtUtc, bool canBackdate, string? reason,
        DateTime candidateCreatedAt, DateTime? followsStatusAt, string? followsStatusName)
    {
        if (scheduledAtUtc > DateTime.UtcNow) return null;
        if (!canBackdate) return FutureOnlyError;
        if (string.IsNullOrWhiteSpace(reason)) return ReasonRequiredError;
        if (scheduledAtUtc < candidateCreatedAt)
            return $"That time is before the candidate was added ({candidateCreatedAt:dd MMM yyyy}).";
        if (followsStatusAt is DateTime at && scheduledAtUtc < at)
            return $"That time is before the candidate reached \"{followsStatusName}\" ({at:dd MMM yyyy}).";
        return null;
    }

    /// <summary>
    /// The candidate's creation time and the status entry an interview booked at Interview Scheduled follows: the one
    /// just before the latest Interview Scheduled entry, or, when none is recorded yet, the latest entry of all.
    /// </summary>
    public static async Task<(DateTime CreatedAt, DateTime? FollowsAt, string? FollowsName)> BoundsAsync(
        AppDbContext db, int candidateId, string interviewScheduledStatus, bool booking)
    {
        var createdAt = await db.Candidates.Where(c => c.Id == candidateId).Select(c => c.CreatedAt).FirstAsync();
        var history = await db.StatusHistories
            .Where(h => h.CandidateId == candidateId)
            .OrderBy(h => h.ChangedAt).ThenBy(h => h.Id)
            .Select(h => new { h.Status, h.ChangedAt })
            .ToListAsync();

        // A booking follows the latest entry; a move follows the entry before the latest Interview Scheduled one.
        var follows = booking
            ? history.LastOrDefault()
            : history.Take(history.FindLastIndex(h => h.Status == interviewScheduledStatus)).LastOrDefault();
        return (createdAt, follows?.ChangedAt, follows?.Status);
    }
}
