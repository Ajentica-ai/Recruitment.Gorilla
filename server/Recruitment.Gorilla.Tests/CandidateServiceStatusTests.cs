using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>Status-transition rules and required-field gates in ValidateStatusChangeAsync
/// (exercises the seeded StatusTransitions graph — note the seed spellings "Ask for Assessment" /
/// "Submission Received").</summary>
public class CandidateServiceStatusTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static StatusChangeDto Change(
        string status, string? comment = null, string? taskDetails = null, string? submissionUrl = null,
        DateTime? interviewAt = null, List<int>? interviewerIds = null, List<int>? interviewTypeIds = null) =>
        new(status, comment, taskDetails, submissionUrl, interviewAt, interviewerIds, interviewTypeIds);

    [Fact]
    public async Task Illegal_transition_is_rejected()
    {
        var c = Data.AddCandidate(status: "Uploaded");
        var error = await Candidates().ValidateStatusChangeAsync(c.Id, Change("Recommended"));
        Assert.Contains("cannot move", error);
    }

    [Fact]
    public async Task Legal_transition_is_allowed()
    {
        var c = Data.AddCandidate(status: "Uploaded");
        Assert.Null(await Candidates().ValidateStatusChangeAsync(c.Id, Change("Ask for Assessment")));
    }

    [Fact]
    public async Task InterviewScheduled_requires_date_and_interviewers()
    {
        var c = Data.AddCandidate(status: "Call for Interview");
        var interviewer = Data.AddUser(Roles.Interviewer);

        Assert.Contains("date/time", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Scheduled", interviewAt: null, interviewerIds: [interviewer.Id])));

        Assert.Contains("at least one interviewer", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Scheduled", interviewAt: DateTime.UtcNow.AddDays(1), interviewerIds: [])));

        Assert.Null(await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Scheduled", interviewAt: DateTime.UtcNow.AddDays(1), interviewerIds: [interviewer.Id])));
    }

    [Fact]
    public async Task InterviewScheduled_rejects_inactive_interviewer_and_unknown_type()
    {
        var c = Data.AddCandidate(status: "Call for Interview");
        var inactive = Data.AddUser(Roles.Interviewer, active: false);
        var active = Data.AddUser(Roles.Interviewer);
        var at = DateTime.UtcNow.AddDays(1);

        Assert.Contains("interviewers are not valid", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Scheduled", interviewAt: at, interviewerIds: [inactive.Id])));

        Assert.Contains("interview types are not valid", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Scheduled", interviewAt: at, interviewerIds: [active.Id], interviewTypeIds: [999999])));
    }

    [Fact]
    public async Task InterviewCompleted_requires_comment_and_a_submitted_evaluation()
    {
        var c = Data.AddCandidate(status: "Interview Scheduled");
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(c.Id, interviewer.Id);

        // No comment.
        Assert.Contains("requires a comment", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Completed")));

        // Comment but no submitted evaluation.
        Assert.Contains("submitted interviewer evaluation", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Completed", comment: "done")));

        // Comment + a submitted evaluation on the latest interview → allowed.
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id);
        Assert.Null(await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Interview Completed", comment: "done")));
    }

    [Fact]
    public async Task Reject_requires_a_comment()
    {
        var c = Data.AddCandidate(status: "Uploaded");
        Assert.Contains("requires a comment", await Candidates().ValidateStatusChangeAsync(c.Id, Change("Reject")));
        Assert.Null(await Candidates().ValidateStatusChangeAsync(c.Id, Change("Reject", comment: "not a fit")));
    }

    [Fact]
    public async Task TechnicalAssessment_requires_task_details()
    {
        var c = Data.AddCandidate(status: "Ask for Assessment");
        Assert.Contains("task details", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Technical Assessment", comment: "assigned")));
        Assert.Null(await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Technical Assessment", comment: "assigned", taskDetails: "Build X")));
    }

    [Fact]
    public async Task SubmissionReceived_requires_a_link()
    {
        var c = Data.AddCandidate(status: "Technical Assessment");
        Assert.Contains("submission link", await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Submission Received")));
        Assert.Null(await Candidates().ValidateStatusChangeAsync(
            c.Id, Change("Submission Received", submissionUrl: "https://github.com/x/y")));
    }

    [Fact]
    public async Task Expired_role_locks_all_status_changes()
    {
        var expiredRole = Data.AddRole(endDate: DateTime.UtcNow.AddDays(-1));
        var c = Data.AddCandidate(roleId: expiredRole.Id, status: "Uploaded");

        // Even an otherwise-legal transition is blocked by the end-date lock.
        var error = await Candidates().ValidateStatusChangeAsync(c.Id, Change("Ask for Assessment"));
        Assert.Contains("extend", error);
    }
}
