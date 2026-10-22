using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Sharing earlier rounds with the next round's panel when booking (#187): grants created from a
/// booking flag, kept in step with panel changes, and revoked on cancel. Manual grants are never
/// touched, and the same-interview peer rule still holds.
/// </summary>
public class PanelAutoShareTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private sealed record World(User Recruiter, Candidate Candidate, Interview Round1, User Round1Panelist);

    /// <summary>A candidate at Interview Scheduled with a finished round 1 (one submitted evaluation).</summary>
    private World Setup()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id, status: "Interview Scheduled");
        var panelist = Data.AddUser(Roles.Interviewer);
        var round1 = Data.AddInterview(candidate.Id, panelist.Id);
        Data.AddSubmittedEvaluation(round1.Id, panelist.Id);
        return new World(recruiter, candidate, round1, panelist);
    }

    private static StatusChangeDto Booking(IEnumerable<int> panel, bool share) =>
        new("Interview Scheduled", InterviewAt: DateTime.UtcNow.AddDays(3), InterviewerUserIds: panel.ToList(),
            ShareEarlierRoundsWithPanel: share);

    private async Task<Interview> BookAsync(World w, IEnumerable<int> panel, bool share)
    {
        var entry = await Candidates().AddStatusAsync(w.Candidate.Id, Booking(panel, share), w.Recruiter.Name, w.Recruiter.Id);
        return await Db.Interviews.AsNoTracking().SingleAsync(i => i.Id == entry!.InterviewId);
    }

    private IQueryable<EvaluationAccessGrant> AutoGrants(int interviewId) =>
        Db.EvaluationAccessGrants.AsNoTracking()
            .Where(g => g.Source == EvaluationAccessGrant.PanelAutoShareSource && g.CreatedForInterviewId == interviewId);

    private Task<(InterviewScheduleDto? Dto, string? Error, bool NotFound, bool Conflict)> RescheduleAsync(
        World w, int interviewId, IEnumerable<int> panel, bool? share) =>
        Interviews().RescheduleAsync(
            interviewId,
            new RescheduleInterviewDto(DateTime.UtcNow.AddDays(4), 60, null, panel.ToList(), null, null, share),
            null, w.Recruiter.Id, w.Recruiter.Name);

    // ---- booking ----

    [Fact]
    public async Task Booking_with_the_flag_gives_each_new_panelist_one_grant_per_earlier_round()
    {
        var w = Setup();
        var cancelled = Data.AddInterview(w.Candidate.Id, w.Round1Panelist.Id);
        cancelled.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);

        var round2 = await BookAsync(w, [a.Id, b.Id], share: true);

        Assert.True(round2.ShareEarlierRoundsWithPanel);
        var grants = await AutoGrants(round2.Id).ToListAsync();
        Assert.Equal(2, grants.Count); // one per panelist; the cancelled round is left out
        Assert.All(grants, g =>
        {
            Assert.Equal(w.Round1.Id, g.InterviewId); // interview-specific, never candidate-wide
            Assert.Equal(w.Candidate.Id, g.CandidateId);
            Assert.Equal(w.Recruiter.Id, g.GrantedByUserId);
            Assert.Null(g.ExpiresAt);
            Assert.Null(g.RevokedAt);
        });
        Assert.Equivalent(new[] { a.Id, b.Id }, grants.Select(g => g.GranteeUserId));
        Assert.Equal(2, Db.AuditLogs.Count(x => x.Action == "EvaluationShare.Granted" && x.EntityId == w.Candidate.Id));
    }

    [Fact]
    public async Task Booking_without_the_flag_shares_nothing()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);

        var round2 = await BookAsync(w, [a.Id], share: false);

        Assert.False(round2.ShareEarlierRoundsWithPanel);
        Assert.Empty(await AutoGrants(round2.Id).ToListAsync());
    }

    [Fact]
    public async Task Panelists_who_already_have_access_are_skipped_and_manual_grants_are_left_alone()
    {
        var w = Setup();
        var admin = Data.AddUser(Roles.Admin);
        var withCandidateWide = Data.AddUser(Roles.Interviewer);
        var withThisRound = Data.AddUser(Roles.Interviewer);
        var plain = Data.AddUser(Roles.Interviewer);
        var wideGrant = new EvaluationAccessGrant
        {
            CandidateId = w.Candidate.Id, GranteeUserId = withCandidateWide.Id, Source = EvaluationAccessGrant.ManualSource,
        };
        var roundGrant = new EvaluationAccessGrant
        {
            CandidateId = w.Candidate.Id, InterviewId = w.Round1.Id, GranteeUserId = withThisRound.Id,
            Source = EvaluationAccessGrant.ManualSource,
        };
        Db.EvaluationAccessGrants.AddRange(wideGrant, roundGrant);
        Db.SaveChanges();

        var round2 = await BookAsync(w, [w.Recruiter.Id, admin.Id, withCandidateWide.Id, withThisRound.Id, plain.Id], share: true);

        // The owner and the Admin read everything anyway, and the two with a covering grant do not
        // get a second, overlapping one. Only the plain Interviewer gains anything.
        var grant = Assert.Single(await AutoGrants(round2.Id).ToListAsync());
        Assert.Equal(plain.Id, grant.GranteeUserId);
        Assert.Null((await Db.EvaluationAccessGrants.AsNoTracking().SingleAsync(g => g.Id == wideGrant.Id)).RevokedAt);
        Assert.Null((await Db.EvaluationAccessGrants.AsNoTracking().SingleAsync(g => g.Id == roundGrant.Id)).RevokedAt);
    }

    [Fact]
    public async Task The_new_panel_reads_the_earlier_round_but_not_the_round_it_still_has_to_evaluate()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);

        var round2 = await BookAsync(w, [a.Id], share: true);

        var visible = await Access().VisibleInterviewIdsAsync(a.Id, w.Candidate.Id);
        Assert.Equal([w.Round1.Id], visible);
        Assert.False(await Access().CanSeeInterviewAsync(a.Id, round2.Id)); // the peer rule is untouched
    }

    // ---- review fixes ----

    [Fact]
    public async Task A_manual_share_of_the_same_round_is_its_own_row_and_survives_the_auto_grant_ending()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var round2 = await BookAsync(w, [a.Id], share: true);

        // The recruiter now shares round 1 with them by hand, with an expiry.
        var (result, error) = await EvaluationShares().CreateAsync(
            w.Candidate.Id,
            new CreateEvaluationSharesDto([a.Id], [w.Round1.Id], DateTime.UtcNow.AddDays(30), "by hand"),
            w.Recruiter.Id, w.Recruiter.Name);
        Assert.Null(error);
        var manual = Assert.Single(result!.Shares);
        Assert.Equal("Manual", manual.Source);
        var auto = await AutoGrants(round2.Id).SingleAsync();
        Assert.Null(auto.ExpiresAt); // the auto row was not touched

        await Interviews().CancelAsync(round2.Id, "Candidate withdrew", null, w.Recruiter.Id, w.Recruiter.Name);

        Assert.NotNull((await AutoGrants(round2.Id).SingleAsync()).RevokedAt);
        Assert.Null((await Db.EvaluationAccessGrants.AsNoTracking().SingleAsync(g => g.Id == manual.Id)).RevokedAt);
        Assert.Equal([w.Round1.Id], await Access().VisibleInterviewIdsAsync(a.Id, w.Candidate.Id));
    }

    [Fact]
    public async Task A_recruiter_cannot_hand_revoke_an_auto_grant()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var round2 = await BookAsync(w, [a.Id], share: true);
        var auto = await AutoGrants(round2.Id).SingleAsync();

        var outcome = await EvaluationShares().RevokeAsync(w.Candidate.Id, auto.Id, w.Recruiter.Id, w.Recruiter.Name);

        Assert.Equal(RevokeShareResult.AutoManaged, outcome);
        Assert.Null((await AutoGrants(round2.Id).SingleAsync()).RevokedAt);
    }

    [Fact]
    public async Task A_round_that_is_held_after_the_new_booking_is_not_shared_even_with_a_lower_id()
    {
        var w = Setup();
        var later = Data.AddInterview(w.Candidate.Id, w.Round1Panelist.Id);
        later.ScheduledAt = DateTime.UtcNow.AddDays(30); // booked earlier, but still to come
        Db.SaveChanges();
        var a = Data.AddUser(Roles.Interviewer);

        var round2 = await BookAsync(w, [a.Id], share: true);

        var grant = Assert.Single(await AutoGrants(round2.Id).ToListAsync());
        Assert.Equal(w.Round1.Id, grant.InterviewId);
    }

    [Fact]
    public async Task Booking_with_no_known_actor_still_creates_the_grants()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);

        var entry = await Candidates().AddStatusAsync(w.Candidate.Id, Booking([a.Id], true), "system", currentUserId: null);

        var grant = Assert.Single(await AutoGrants(entry!.InterviewId!.Value).ToListAsync());
        Assert.Null(grant.GrantedByUserId);
    }

    // ---- notification ----

    [Fact]
    public async Task Interview_assigned_mentions_earlier_rounds_only_for_people_who_got_access()
    {
        var w = Setup();
        var admin = Data.AddUser(Roles.Admin);
        var a = Data.AddUser(Roles.Interviewer);

        await BookAsync(w, [a.Id, admin.Id], share: true);

        var forA = await Db.Notifications.SingleAsync(n => n.UserId == a.Id && n.Title == "Interview assigned");
        var forAdmin = await Db.Notifications.SingleAsync(n => n.UserId == admin.Id && n.Title == "Interview assigned");
        Assert.Contains("earlier rounds", forA.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("earlier rounds", forAdmin.Message, StringComparison.OrdinalIgnoreCase);
        // No separate "shared with you" notification for an automatic grant.
        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == a.Id && n.Title == "Interview evaluations shared with you"));
    }

    // ---- reschedule ----

    [Fact]
    public async Task Reschedule_gives_added_panelists_the_grants_and_revokes_removed_ones_leaving_retained_alone()
    {
        var w = Setup();
        var kept = Data.AddUser(Roles.Interviewer);
        var removed = Data.AddUser(Roles.Interviewer);
        var added = Data.AddUser(Roles.Interviewer);
        var round2 = await BookAsync(w, [kept.Id, removed.Id], share: true);
        var keptGrantId = (await AutoGrants(round2.Id).SingleAsync(g => g.GranteeUserId == kept.Id)).Id;

        var (dto, error, _, _) = await RescheduleAsync(w, round2.Id, [kept.Id, added.Id], share: null);

        Assert.Null(error);
        Assert.True(dto!.ShareEarlierRoundsWithPanel); // null leaves the flag as booked
        var grants = await AutoGrants(round2.Id).ToListAsync();
        Assert.Null(grants.Single(g => g.GranteeUserId == kept.Id).RevokedAt);
        Assert.Equal(keptGrantId, grants.Single(g => g.GranteeUserId == kept.Id).Id); // untouched, not recreated
        Assert.Null(grants.Single(g => g.GranteeUserId == added.Id).RevokedAt);
        var revoked = grants.Single(g => g.GranteeUserId == removed.Id);
        Assert.NotNull(revoked.RevokedAt);
        Assert.Equal(w.Recruiter.Id, revoked.RevokedByUserId);
        Assert.True(Db.AuditLogs.Any(x => x.Action == "EvaluationShare.Revoked" && x.EntityId == w.Candidate.Id));
    }

    [Fact]
    public async Task Turning_the_flag_off_revokes_every_auto_grant_and_back_on_recreates_them_without_duplicates()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var round2 = await BookAsync(w, [a.Id], share: true);

        await RescheduleAsync(w, round2.Id, [a.Id], share: false);
        Assert.All(await AutoGrants(round2.Id).ToListAsync(), g => Assert.NotNull(g.RevokedAt));
        Assert.Empty(await Access().VisibleInterviewIdsAsync(a.Id, w.Candidate.Id));

        await RescheduleAsync(w, round2.Id, [a.Id], share: true);
        await RescheduleAsync(w, round2.Id, [a.Id], share: true); // idempotent
        var active = await AutoGrants(round2.Id).Where(g => g.RevokedAt == null).ToListAsync();
        Assert.Single(active);
        Assert.Equal([w.Round1.Id], await Access().VisibleInterviewIdsAsync(a.Id, w.Candidate.Id));
    }

    [Fact]
    public async Task Reschedule_never_touches_manual_grants_even_when_the_panelist_is_removed()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var manual = new EvaluationAccessGrant
        {
            CandidateId = w.Candidate.Id, InterviewId = w.Round1.Id, GranteeUserId = a.Id,
            Source = EvaluationAccessGrant.ManualSource,
        };
        Db.EvaluationAccessGrants.Add(manual);
        Db.SaveChanges();
        var round2 = await BookAsync(w, [a.Id, b.Id], share: true);

        await RescheduleAsync(w, round2.Id, [b.Id], share: false);

        Assert.Null((await Db.EvaluationAccessGrants.AsNoTracking().SingleAsync(g => g.Id == manual.Id)).RevokedAt);
    }

    // ---- cancel ----

    [Fact]
    public async Task Cancelling_the_booking_revokes_its_auto_grants_only()
    {
        var w = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var manual = new EvaluationAccessGrant
        {
            CandidateId = w.Candidate.Id, GranteeUserId = a.Id, Source = EvaluationAccessGrant.ManualSource,
        };
        Db.EvaluationAccessGrants.Add(manual);
        Db.SaveChanges();
        var b = Data.AddUser(Roles.Interviewer);
        var round2 = await BookAsync(w, [a.Id, b.Id], share: true);
        Assert.NotEmpty(await AutoGrants(round2.Id).ToListAsync());

        var (_, error, _, _) = await Interviews().CancelAsync(round2.Id, "Candidate withdrew", null, w.Recruiter.Id, w.Recruiter.Name);

        Assert.Null(error);
        Assert.All(await AutoGrants(round2.Id).ToListAsync(), g => Assert.NotNull(g.RevokedAt));
        Assert.Null((await Db.EvaluationAccessGrants.AsNoTracking().SingleAsync(g => g.Id == manual.Id)).RevokedAt);
        Assert.Empty(await Access().VisibleInterviewIdsAsync(b.Id, w.Candidate.Id));
    }
}
