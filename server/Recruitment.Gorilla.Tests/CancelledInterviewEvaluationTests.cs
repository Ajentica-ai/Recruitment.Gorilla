using System.Net;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// A cancelled interview never happened, so it cannot be evaluated, and anything already on it must not
/// count (#189). The write is refused before anything is stored, the detail says nobody can evaluate,
/// and the candidate's report skips it.
/// </summary>
public class CancelledInterviewEvaluationTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private (Candidate Candidate, Interview Interview, User Interviewer, User Admin) Setup(bool cancelled)
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        if (cancelled)
        {
            interview.Status = InterviewStatuses.Cancelled;
            Db.SaveChanges();
        }
        return (candidate, interview, interviewer, admin);
    }

    private Task<(InterviewEvaluationDto? Dto, string? Error, bool NotFound, bool Conflict)> Save(
        Interview interview, User interviewer, bool submit)
    {
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();
        return Interviews().UpsertEvaluationAsync(
            interview.Id, interviewer.Id, new UpsertEvaluationDto("ok", "Recommended", null, 4, items, submit));
    }

    // ---- the write is refused ----

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Saving_or_submitting_on_a_cancelled_interview_is_a_conflict_and_stores_nothing(bool submit)
    {
        var (_, interview, interviewer, _) = Setup(cancelled: true);

        var (dto, error, notFound, conflict) = await Save(interview, interviewer, submit);

        Assert.Null(dto);
        Assert.False(notFound);
        Assert.True(conflict);
        Assert.Equal("This interview was cancelled.", error);
        Assert.False(await Db.InterviewEvaluations.AnyAsync(e => e.InterviewId == interview.Id));
    }

    [Fact]
    public async Task A_refused_submit_sends_no_evaluation_submitted_notification()
    {
        var (_, interview, interviewer, admin) = Setup(cancelled: true);

        await Save(interview, interviewer, submit: true);

        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == admin.Id && n.Title == "Evaluation submitted"));
    }

    [Fact]
    public async Task A_live_interview_can_still_be_saved_and_submitted()
    {
        var (_, interview, interviewer, _) = Setup(cancelled: false);

        var (draft, draftError, _, draftConflict) = await Save(interview, interviewer, submit: false);
        var (final, finalError, _, finalConflict) = await Save(interview, interviewer, submit: true);

        Assert.Null(draftError);
        Assert.False(draftConflict);
        Assert.NotNull(draft);
        Assert.Null(finalError);
        Assert.False(finalConflict);
        Assert.True(final!.IsSubmitted);
    }

    // ---- the detail ----

    [Fact]
    public async Task The_detail_says_nobody_can_evaluate_a_cancelled_interview_but_a_live_one_yes()
    {
        var cancelled = Setup(cancelled: true);
        var live = Setup(cancelled: false);

        var cancelledDetail = await Interviews().GetDetailAsync(cancelled.Interview.Id, cancelled.Interviewer.Id, isAdmin: false);
        var liveDetail = await Interviews().GetDetailAsync(live.Interview.Id, live.Interviewer.Id, isAdmin: false);

        Assert.False(cancelledDetail!.CanEvaluate);
        Assert.Equal("Cancelled", cancelledDetail.Status);
        Assert.True(liveDetail!.CanEvaluate);
    }

    // ---- the report ----

    [Fact]
    public async Task The_report_skips_an_evaluation_that_is_already_on_a_cancelled_interview()
    {
        var (candidate, cancelled, interviewer, admin) = Setup(cancelled: false);
        var panelist = Data.AddUser(Roles.Interviewer);
        var real = Data.AddInterview(candidate.Id, panelist.Id);
        Data.AddSubmittedEvaluation(real.Id, panelist.Id, overallRating: 5, recommendation: "Recommended");
        // A row written before this rule existed: submitted on an interview that was then cancelled.
        Data.AddSubmittedEvaluation(cancelled.Id, interviewer.Id, overallRating: 1, recommendation: "Reject");
        cancelled.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        var report = await Interviews().GetCandidateEvaluationReportAsync(candidate.Id, null);

        var only = Assert.Single(report!.Evaluations);
        Assert.Equal(real.Id, only.InterviewId);
        Assert.Equal(5, report.Summary.AverageOverall);
        Assert.Equal(1, report.Summary.InterviewerCount);
        Assert.Equal("Recommended", Assert.Single(report.Summary.RecommendationCounts).Recommendation);
    }

    // ---- drafts are kept on cancel ----

    [Fact]
    public async Task Cancelling_keeps_an_unsubmitted_draft_but_the_page_can_no_longer_edit_it()
    {
        var (candidate, interview, interviewer, admin) = Setup(cancelled: false);
        await Save(interview, interviewer, submit: false);

        var (_, error, _, _) = await Interviews().CancelAsync(interview.Id, "No longer needed", null, admin.Id, admin.Name);

        Assert.Null(error);
        Assert.True(await Db.InterviewEvaluations.AnyAsync(e => e.InterviewId == interview.Id && !e.IsSubmitted));
        var (_, editError, _, conflict) = await Save(interview, interviewer, submit: false);
        Assert.True(conflict);
        Assert.Equal("This interview was cancelled.", editError);
    }
}

/// <summary>The same rule over the real HTTP pipeline: the interviewer gets a 409, not a 200.</summary>
[Collection(ApiCollection.Name)]
public class CancelledInterviewEvaluationApiTests(ApiFixture fx)
{
    [Fact]
    public async Task An_interviewer_gets_409_when_saving_or_submitting_after_the_interview_was_cancelled()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(candidateId, fx.InterviewerId);
        var admin = await fx.LoginAsync(fx.AdminEmail);
        var interviewer = await fx.LoginAsync(fx.InterviewerEmail);
        var cancel = await fx.SendAsync(HttpMethod.Post, $"/api/interviews/{interviewId}/cancel", admin, new { reason = "No longer needed" });
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        foreach (var submit in new[] { false, true })
        {
            var resp = await fx.SendAsync(HttpMethod.Put, $"/api/interviews/{interviewId}/evaluation", interviewer, new
            {
                recommendation = "Recommended", overallRating = 4,
                items = new[] { new { criterionKey = "RelevanceOfExperience", rating = 4, comment = (string?)null } },
                submit,
            });
            Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
            Assert.Contains("This interview was cancelled.", await resp.Content.ReadAsStringAsync());
        }

        var detail = await fx.SendAsync(HttpMethod.Get, $"/api/interviews/{interviewId}", interviewer);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        Assert.Contains("\"canEvaluate\":false", await detail.Content.ReadAsStringAsync());
    }
}
