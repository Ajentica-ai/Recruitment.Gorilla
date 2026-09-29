using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>InterviewService.UpsertEvaluationAsync — access, the submit gate, submit-lock, and field validation.</summary>
public class InterviewServiceEvaluationTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static List<EvaluationItemDto> AllRated(int rating = 4) =>
        EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, rating, null)).ToList();

    private static UpsertEvaluationDto Eval(
        bool submit, string? recommendation = "Recommended", string? recommendationOther = null,
        int? overall = 4, List<EvaluationItemDto>? items = null) =>
        new(null, recommendation, recommendationOther, overall, items ?? AllRated(), submit);

    /// <summary>Sets up an interview with one assigned interviewer; returns (interviewId, interviewerUserId).</summary>
    private (int InterviewId, int UserId) Assigned()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        return (interview.Id, interviewer.Id);
    }

    [Fact]
    public async Task NonAssigned_user_is_not_found()
    {
        var (interviewId, _) = Assigned();
        var stranger = Data.AddUser(Roles.Interviewer);

        var (_, _, notFound, _) = await Interviews().UpsertEvaluationAsync(interviewId, stranger.Id, Eval(submit: false));
        Assert.True(notFound);
    }

    [Fact]
    public async Task Draft_with_partial_data_is_allowed()
    {
        var (interviewId, userId) = Assigned();

        var (dto, error, notFound, conflict) = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, Eval(submit: false, recommendation: null, overall: null, items: [AllRated()[0]]));

        Assert.NotNull(dto);
        Assert.Null(error);
        Assert.False(notFound);
        Assert.False(conflict);
    }

    [Fact]
    public async Task Submit_requires_recommendation_overall_and_all_twelve_ratings()
    {
        var (interviewId, userId) = Assigned();

        var missingRec = await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: true, recommendation: null));
        Assert.Contains("recommendation is required", missingRec.Error);

        var missingOverall = await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: true, overall: null));
        Assert.Contains("overall rating is required", missingOverall.Error);

        var elevenRated = AllRated().Take(11).ToList();
        var incomplete = await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: true, items: elevenRated));
        Assert.Contains("rate all evaluation criteria", incomplete.Error);
    }

    [Fact]
    public async Task Complete_submit_locks_and_a_second_submit_conflicts()
    {
        var (interviewId, userId) = Assigned();

        var first = await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: true));
        Assert.Null(first.Error);
        Assert.NotNull(first.Dto);
        Assert.True(first.Dto!.IsSubmitted);

        var second = await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: true));
        Assert.True(second.Conflict);
    }

    [Fact]
    public async Task Invalid_criterion_key_and_out_of_range_rating_are_rejected()
    {
        var (interviewId, userId) = Assigned();

        var badKey = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, Eval(submit: false, items: [new EvaluationItemDto("NotAKey", 3, null)]));
        Assert.Contains("Unknown criterion", badKey.Error);

        var badRating = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, Eval(submit: false, items: [new EvaluationItemDto(EvaluationCriteria.Keys.First(), 6, null)]));
        Assert.Contains("between 1 and 5", badRating.Error);
    }

    [Fact]
    public async Task Recommendation_Other_requires_specify_text()
    {
        var (interviewId, userId) = Assigned();

        var missing = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, Eval(submit: false, recommendation: "Other", recommendationOther: null));
        Assert.Contains("specify", missing.Error);

        var ok = await Interviews().UpsertEvaluationAsync(
            interviewId, userId, Eval(submit: false, recommendation: "Other", recommendationOther: "Second round"));
        Assert.Null(ok.Error);
    }

    // ----- Peer visibility: see others only after submitting & locking your own -----

    [Fact]
    public async Task Interviewer_sees_no_peer_evaluations_until_they_submit_their_own()
    {
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, a.Id, b.Id);
        Data.AddSubmittedEvaluation(interview.Id, b.Id); // B already submitted

        // A hasn't submitted → no peer evaluations exposed.
        var before = await Interviews().GetDetailAsync(interview.Id, a.Id, isAdmin: false);
        Assert.NotNull(before);
        Assert.Null(before!.AllEvaluations);
    }

    [Fact]
    public async Task Interviewer_sees_peers_submitted_only_after_submitting_never_own_or_drafts()
    {
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var c = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, a.Id, b.Id, c.Id);
        Data.AddSubmittedEvaluation(interview.Id, b.Id);                       // B submitted
        await Interviews().UpsertEvaluationAsync(interview.Id, c.Id, Eval(submit: false)); // C draft
        await Interviews().UpsertEvaluationAsync(interview.Id, a.Id, Eval(submit: true));  // A submits own

        var detail = await Interviews().GetDetailAsync(interview.Id, a.Id, isAdmin: false);

        Assert.NotNull(detail!.AllEvaluations);
        var shown = detail.AllEvaluations!;
        Assert.Contains(shown, e => e.InterviewerUserId == b.Id);   // peer, submitted → shown
        Assert.DoesNotContain(shown, e => e.InterviewerUserId == c.Id); // peer, draft → hidden
        Assert.DoesNotContain(shown, e => e.InterviewerUserId == a.Id); // own → never in "others"
    }

    [Fact]
    public async Task Admin_sees_all_evaluations_including_drafts()
    {
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, a.Id, b.Id);
        Data.AddSubmittedEvaluation(interview.Id, a.Id);
        await Interviews().UpsertEvaluationAsync(interview.Id, b.Id, Eval(submit: false)); // B draft

        var stranger = Data.AddUser(Roles.Admin); // not assigned
        var detail = await Interviews().GetDetailAsync(interview.Id, stranger.Id, isAdmin: true);

        Assert.NotNull(detail!.AllEvaluations);
        Assert.Equal(2, detail.AllEvaluations!.Count); // both the submitted and the draft
    }

    // ----- Candidate evaluation report (Recruiter+, candidate-access-scoped) -----

    [Fact]
    public async Task Report_aggregates_submitted_evaluations_and_ignores_drafts()
    {
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var c = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, a.Id, b.Id, c.Id);
        Data.AddSubmittedEvaluation(interview.Id, a.Id, overallRating: 4, recommendation: "Recommended");
        Data.AddSubmittedEvaluation(interview.Id, b.Id, overallRating: 2, recommendation: "Hold");
        await Interviews().UpsertEvaluationAsync(interview.Id, c.Id, Eval(submit: false)); // draft, excluded

        var report = await Interviews().GetCandidateEvaluationReportAsync(candidate.Id, ownerScope: null);

        Assert.NotNull(report);
        Assert.Equal(2, report!.Summary.InterviewerCount);
        Assert.Equal(3.0, report.Summary.AverageOverall);                 // (4 + 2) / 2
        Assert.Equal(12, report.Summary.CriterionAverages.Count);          // every key rated by both
        Assert.All(report.Summary.CriterionAverages, c => Assert.Equal(4.0, c.Average));
        Assert.Contains(report.Summary.RecommendationCounts, r => r.Recommendation == "Recommended" && r.Count == 1);
        Assert.Contains(report.Summary.RecommendationCounts, r => r.Recommendation == "Hold" && r.Count == 1);
        Assert.Equal(2, report.Evaluations.Count);
    }

    [Fact]
    public async Task Report_respects_candidate_access_scope()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var otherRole = Data.AddRole();

        var visible = Data.AddCandidate(ownerUserId: admin.Id, roleId: assignedRole.Id);
        var hidden = Data.AddCandidate(ownerUserId: admin.Id, roleId: otherRole.Id);

        Assert.NotNull(await Interviews().GetCandidateEvaluationReportAsync(visible.Id, recruiter.Id));
        Assert.Null(await Interviews().GetCandidateEvaluationReportAsync(hidden.Id, recruiter.Id));
    }

    // ---- Issue #76: a submitted evaluation notifies the people who act on it ----

    /// <summary>Notification titles raised for a user, so a test asserts on content, not just a count.</summary>
    private List<string> NotificationsFor(int userId) =>
        Db.Notifications.Where(n => n.UserId == userId).Select(n => n.Title).ToList();

    [Fact]
    public async Task Submit_notifies_admins_and_super_admins()
    {
        var admin = Data.AddUser(Roles.Admin);
        var superAdmin = Data.AddUser(Roles.SuperAdmin);
        var interviewer = Data.AddUser(Roles.Interviewer, name: "Ivy Interviewer");
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        await Interviews().UpsertEvaluationAsync(interview.Id, interviewer.Id, Eval(submit: true));

        Assert.Equal(["Evaluation submitted"], NotificationsFor(admin.Id));
        Assert.Equal(["Evaluation submitted"], NotificationsFor(superAdmin.Id));

        var sent = Db.Notifications.First(n => n.UserId == admin.Id);
        Assert.Contains("Ivy Interviewer", sent.Message);
        Assert.Contains(candidate.FullName, sent.Message);
        Assert.Equal($"/candidates/{candidate.Id}/evaluations", sent.LinkUrl);
    }

    [Fact]
    public async Task Draft_save_notifies_nobody()
    {
        var admin = Data.AddUser(Roles.Admin);
        var (interviewId, userId) = Assigned();

        await Interviews().UpsertEvaluationAsync(interviewId, userId, Eval(submit: false));

        Assert.Empty(NotificationsFor(admin.Id));
    }

    [Fact]
    public async Task Submitter_is_not_notified_about_their_own_evaluation()
    {
        // An Admin can also be an assigned interviewer; they should not be told about their own submit.
        var adminInterviewer = Data.AddUser(Roles.Admin);
        var otherAdmin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, adminInterviewer.Id);

        await Interviews().UpsertEvaluationAsync(interview.Id, adminInterviewer.Id, Eval(submit: true));

        Assert.Empty(NotificationsFor(adminInterviewer.Id));
        Assert.Single(NotificationsFor(otherAdmin.Id));
    }

    [Fact]
    public async Task Only_recruiters_who_can_see_the_candidate_are_notified()
    {
        var owningRecruiter = Data.AddUser(Roles.Recruiter);
        var assignedRecruiter = Data.AddUser(Roles.Recruiter);
        var strangerRecruiter = Data.AddUser(Roles.Recruiter);
        var inactiveAdmin = Data.AddUser(Roles.Admin, active: false);
        var interviewer = Data.AddUser(Roles.Interviewer);

        var role = Data.AddRole(recruiterUserIds: assignedRecruiter.Id);
        var candidate = Data.AddCandidate(ownerUserId: owningRecruiter.Id, roleId: role.Id);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        await Interviews().UpsertEvaluationAsync(interview.Id, interviewer.Id, Eval(submit: true));

        Assert.Single(NotificationsFor(owningRecruiter.Id));
        Assert.Single(NotificationsFor(assignedRecruiter.Id));
        Assert.Empty(NotificationsFor(strangerRecruiter.Id));
        Assert.Empty(NotificationsFor(inactiveAdmin.Id));
    }
}
