using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The one grantee access predicate (#184): an active grant covering the interview, unless the
/// grantee is a panelist on it who has not submitted their own evaluation (the peer rule).
/// </summary>
public class EvaluationAccessTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private EvaluationAccessGrant Grant(
        Candidate candidate, User grantee, int? interviewId = null,
        DateTime? expiresAt = null, DateTime? revokedAt = null)
    {
        var grant = new EvaluationAccessGrant
        {
            CandidateId = candidate.Id, InterviewId = interviewId, GranteeUserId = grantee.Id,
            Source = EvaluationAccessGrant.ManualSource, ExpiresAt = expiresAt, RevokedAt = revokedAt,
        };
        Db.EvaluationAccessGrants.Add(grant);
        Db.SaveChanges();
        return grant;
    }

    private (Candidate Candidate, User Panelist, User Grantee, Interview Round1, Interview Round2) Setup()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var panelist = Data.AddUser(Roles.Interviewer);
        var grantee = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id);
        var r1 = Data.AddInterview(candidate.Id, panelist.Id);
        var r2 = Data.AddInterview(candidate.Id, panelist.Id);
        return (candidate, panelist, grantee, r1, r2);
    }

    private async Task<List<int>> Visible(User user, Candidate candidate) =>
        (await Access().VisibleInterviewIdsAsync(user.Id, candidate.Id)).Order().ToList();

    [Fact]
    public async Task No_grant_means_nothing_is_visible()
    {
        var (candidate, _, grantee, _, _) = Setup();
        Assert.Empty(await Visible(grantee, candidate));
        Assert.False(await Access().HasActiveGrantAsync(grantee.Id, candidate.Id));
    }

    [Fact]
    public async Task A_candidate_wide_grant_shows_every_round()
    {
        var (candidate, _, grantee, r1, r2) = Setup();
        Grant(candidate, grantee);
        Assert.Equal(new[] { r1.Id, r2.Id }.Order().ToList(), await Visible(grantee, candidate));
        Assert.True(await Access().HasActiveGrantAsync(grantee.Id, candidate.Id));
    }

    [Fact]
    public async Task An_interview_specific_grant_shows_only_that_round()
    {
        var (candidate, _, grantee, r1, _) = Setup();
        Grant(candidate, grantee, r1.Id);
        Assert.Equal([r1.Id], await Visible(grantee, candidate));
    }

    [Fact]
    public async Task Revoked_and_expired_grants_show_nothing()
    {
        var (candidate, _, grantee, _, _) = Setup();
        var other = Data.AddUser(Roles.Interviewer);
        Grant(candidate, grantee, revokedAt: DateTime.UtcNow.AddMinutes(-1));
        Grant(candidate, other, expiresAt: DateTime.UtcNow.AddMinutes(-1));

        Assert.Empty(await Visible(grantee, candidate));
        Assert.Empty(await Visible(other, candidate));
        Assert.False(await Access().HasActiveGrantAsync(grantee.Id, candidate.Id));
        Assert.False(await Access().HasActiveGrantAsync(other.Id, candidate.Id));
    }

    [Fact]
    public async Task A_deactivated_grantee_sees_nothing_even_with_an_active_grant()
    {
        var (candidate, _, _, _, _) = Setup();
        var inactive = Data.AddUser(Roles.Interviewer, active: false);
        Grant(candidate, inactive);
        Assert.Empty(await Visible(inactive, candidate));
        Assert.False(await Access().HasActiveGrantAsync(inactive.Id, candidate.Id));
    }

    [Fact]
    public async Task A_grant_on_one_candidate_does_not_leak_to_another()
    {
        var (candidate, _, grantee, _, _) = Setup();
        var otherCandidate = Data.AddCandidate();
        Data.AddInterview(otherCandidate.Id);
        Grant(candidate, grantee);
        Assert.Empty(await Visible(grantee, otherCandidate));
    }

    [Fact]
    public async Task A_panelist_who_has_not_submitted_cannot_see_that_round_but_sees_the_others()
    {
        var (candidate, _, _, r1, _) = Setup();
        var panelist2 = Data.AddUser(Roles.Interviewer);
        var r4 = Data.AddInterview(candidate.Id, panelist2.Id);
        Grant(candidate, panelist2);

        // panelist2 sits on r4 with nothing submitted: r4 is hidden, the other rounds are visible.
        var visible = await Visible(panelist2, candidate);
        Assert.DoesNotContain(r4.Id, visible);
        Assert.Contains(r1.Id, visible);
        Assert.False(await Access().CanSeeInterviewAsync(panelist2.Id, r4.Id));
        Assert.True(await Access().CanSeeInterviewAsync(panelist2.Id, r1.Id));
    }

    [Fact]
    public async Task A_panelist_who_has_submitted_sees_that_round()
    {
        var (candidate, _, _, _, _) = Setup();
        var panelist = Data.AddUser(Roles.Interviewer);
        var round = Data.AddInterview(candidate.Id, panelist.Id);
        Data.AddSubmittedEvaluation(round.Id, panelist.Id);
        Grant(candidate, panelist);

        Assert.Contains(round.Id, await Visible(panelist, candidate));
        Assert.True(await Access().CanSeeInterviewAsync(panelist.Id, round.Id));
    }

    [Fact]
    public async Task A_draft_evaluation_does_not_count_as_submitted_for_the_peer_rule()
    {
        var (candidate, _, _, _, _) = Setup();
        var panelist = Data.AddUser(Roles.Interviewer);
        var round = Data.AddInterview(candidate.Id, panelist.Id);
        Db.InterviewEvaluations.Add(new InterviewEvaluation
        {
            InterviewId = round.Id, InterviewerUserId = panelist.Id, IsSubmitted = false,
        });
        Db.SaveChanges();
        Grant(candidate, panelist);

        Assert.DoesNotContain(round.Id, await Visible(panelist, candidate));
    }

    [Fact]
    public async Task A_cancelled_interview_is_never_visible_and_does_not_notify_grantees()
    {
        var (candidate, panelist, grantee, r1, r2) = Setup();
        Grant(candidate, grantee);
        r1.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        Assert.Equal([r2.Id], await Visible(grantee, candidate));
        Assert.False(await Access().CanSeeInterviewAsync(grantee.Id, r1.Id));

        // Submitting on a cancelled round is refused outright (#189), so nobody is notified either.
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();
        var (dto, error, _, conflict) = await Interviews().UpsertEvaluationAsync(
            r1.Id, panelist.Id, new UpsertEvaluationDto(null, "Recommended", null, 4, items, true));
        Assert.Null(dto);
        Assert.True(conflict);
        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == grantee.Id && n.Title == "Evaluation submitted"));
    }

    // ---- the report builder takes an interview filter ----

    [Fact]
    public async Task The_filtered_report_covers_only_the_allowed_interviews_and_never_drafts()
    {
        var (candidate, panelist, _, r1, r2) = Setup();
        Data.AddSubmittedEvaluation(r1.Id, panelist.Id, overallRating: 5, recommendation: "Recommended");
        Data.AddSubmittedEvaluation(r2.Id, panelist.Id, overallRating: 1, recommendation: "Reject");
        var other = Data.AddUser(Roles.Interviewer);
        Db.InterviewEvaluations.Add(new InterviewEvaluation
        {
            InterviewId = r1.Id, InterviewerUserId = other.Id, IsSubmitted = false, OverallRating = 2,
        });
        Db.SaveChanges();

        var report = await Interviews().GetCandidateEvaluationReportAsync(candidate.Id, null, [r1.Id]);

        Assert.NotNull(report);
        var only = Assert.Single(report!.Evaluations);
        Assert.Equal(r1.Id, only.InterviewId);
        Assert.Equal(5, report.Summary.AverageOverall);
        var tally = Assert.Single(report.Summary.RecommendationCounts);
        Assert.Equal("Recommended", tally.Recommendation);
    }

    [Fact]
    public async Task The_unfiltered_report_is_unchanged()
    {
        var (candidate, panelist, _, r1, r2) = Setup();
        Data.AddSubmittedEvaluation(r1.Id, panelist.Id);
        Data.AddSubmittedEvaluation(r2.Id, panelist.Id);

        var report = await Interviews().GetCandidateEvaluationReportAsync(candidate.Id, null);

        Assert.Equal(2, report!.Evaluations.Count);
    }

    // ---- submit fan-out ----

    /// <summary>Submits a full evaluation and fails the test if the submit itself was rejected.</summary>
    private async Task SubmitAsync(int interviewId, int userId)
    {
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();
        var (dto, error, _, _) = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, new UpsertEvaluationDto(null, "Recommended", null, 4, items, true));
        Assert.Null(error);
        Assert.NotNull(dto);
        Assert.True(dto!.IsSubmitted);
    }

    [Fact]
    public async Task Submitting_notifies_grantees_covering_the_interview_with_a_shared_link()
    {
        var (candidate, panelist, grantee, r1, _) = Setup();
        Grant(candidate, grantee, r1.Id);

        await SubmitAsync(r1.Id, panelist.Id);

        var n = Assert.Single(await Db.Notifications
            .Where(n => n.UserId == grantee.Id && n.Title == "Evaluation submitted").ToListAsync());
        Assert.Equal($"/shared/candidates/{candidate.Id}/evaluations", n.LinkUrl);
    }

    [Fact]
    public async Task Fan_out_skips_grantees_outside_the_grant_revoked_inactive_and_unsubmitted_panelists()
    {
        var (candidate, panelist, _, _, r2) = Setup();
        var wrongRound = Data.AddUser(Roles.Interviewer);
        var revoked = Data.AddUser(Roles.Interviewer);
        var inactive = Data.AddUser(Roles.Interviewer, active: false);
        var colleague = Data.AddUser(Roles.Interviewer);
        var shared = Data.AddInterview(candidate.Id, colleague.Id, panelist.Id);
        Grant(candidate, wrongRound, r2.Id);
        Grant(candidate, revoked, revokedAt: DateTime.UtcNow.AddMinutes(-1));
        Grant(candidate, inactive);
        Grant(candidate, colleague); // unsubmitted panelist on the round being submitted

        await SubmitAsync(shared.Id, panelist.Id);

        foreach (var user in new[] { wrongRound, revoked, inactive, colleague })
            Assert.False(
                await Db.Notifications.AnyAsync(n => n.UserId == user.Id && n.Title == "Evaluation submitted"),
                $"user {user.Id} should not be notified");
    }

    [Fact]
    public async Task Fan_out_never_notifies_the_submitter()
    {
        var (candidate, panelist, _, r1, _) = Setup();
        Grant(candidate, panelist);

        await SubmitAsync(r1.Id, panelist.Id);

        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == panelist.Id && n.Title == "Evaluation submitted"));
    }
}
