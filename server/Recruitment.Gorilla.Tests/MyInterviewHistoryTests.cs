using System.Net;
using System.Text.Json;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The "My interviews" history (#203): a paged, filterable view of the interviews a user is assigned to, with their own
/// evaluation, including cancelled ones. <c>GET /api/interviews/mine</c> stays the dashboard's unbounded list.
/// </summary>
public class MyInterviewHistoryTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static readonly DateTime Now = new(2026, 10, 25, 12, 0, 0, DateTimeKind.Utc);

    private Interview Book(Candidate candidate, User interviewer, double hoursFromNow, string status = InterviewStatuses.Scheduled)
    {
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.ScheduledAt = Now.AddHours(hoursFromNow);
        interview.Status = status;
        Db.SaveChanges();
        return interview;
    }

    private Task<MyInterviewHistoryDto> History(User user, string? tab, string? search = null, int page = 1, int pageSize = 20) =>
        Interviews().GetMineHistoryAsync(user.Id, tab, search, page, pageSize, Now);

    /// <summary>One interviewer with: an upcoming, an awaiting (past, no evaluation), a submitted and a cancelled interview.</summary>
    private (User Me, Interview Upcoming, Interview Awaiting, Interview Submitted, Interview Cancelled) Mine()
    {
        var me = Data.AddUser(Roles.Interviewer);
        var upcoming = Book(Data.AddCandidate(), me, +48);
        var awaiting = Book(Data.AddCandidate(), me, -48);
        var submitted = Book(Data.AddCandidate(), me, -96);
        Data.AddSubmittedEvaluation(submitted.Id, me.Id, overallRating: 5, recommendation: "Recommended");
        var cancelled = Book(Data.AddCandidate(), me, +24, InterviewStatuses.Cancelled);
        return (me, upcoming, awaiting, submitted, cancelled);
    }

    [Fact]
    public async Task Each_tab_holds_exactly_its_own_interviews()
    {
        var (me, upcoming, awaiting, submitted, cancelled) = Mine();

        Assert.Equal([upcoming.Id], (await History(me, "upcoming")).Items.Select(i => i.Id));
        Assert.Equal([awaiting.Id], (await History(me, "awaiting")).Items.Select(i => i.Id));
        Assert.Equal([submitted.Id], (await History(me, "submitted")).Items.Select(i => i.Id));
        Assert.Equal([cancelled.Id], (await History(me, "cancelled")).Items.Select(i => i.Id));
    }

    [Fact]
    public async Task The_counts_cover_every_tab_whichever_one_is_open()
    {
        var (me, _, _, _, _) = Mine();

        var counts = (await History(me, "submitted")).Counts;

        Assert.Equal(new MyInterviewCountsDto(1, 1, 1, 1), counts);
    }

    [Fact]
    public async Task A_draft_counts_as_awaiting_and_a_cancelled_interview_is_never_awaiting_or_upcoming()
    {
        var me = Data.AddUser(Roles.Interviewer);
        var withDraft = Book(Data.AddCandidate(), me, -30);
        Db.InterviewEvaluations.Add(new InterviewEvaluation { InterviewId = withDraft.Id, InterviewerUserId = me.Id, IsSubmitted = false });
        var pastCancelled = Book(Data.AddCandidate(), me, -30, InterviewStatuses.Cancelled);
        Db.SaveChanges();

        var awaiting = await History(me, "awaiting");

        Assert.Equal([withDraft.Id], awaiting.Items.Select(i => i.Id));
        Assert.Equal("Draft", awaiting.Items.Single().EvaluationState);
        Assert.DoesNotContain(pastCancelled.Id, (await History(me, "upcoming")).Items.Select(i => i.Id));
    }

    [Fact]
    public async Task A_submitted_row_carries_the_recommendation_and_rating_the_user_gave()
    {
        var (me, _, _, submitted, _) = Mine();

        var row = (await History(me, "submitted")).Items.Single();

        Assert.Equal(submitted.Id, row.Id);
        Assert.Equal("Submitted", row.EvaluationState);
        Assert.Equal("Recommended", row.Recommendation);
        Assert.Equal(5, row.OverallRating);
    }

    [Fact]
    public async Task Other_rows_carry_no_recommendation_or_rating()
    {
        var (me, _, _, _, _) = Mine();

        Assert.All((await History(me, "awaiting")).Items, r => { Assert.Null(r.Recommendation); Assert.Null(r.OverallRating); });
        Assert.All((await History(me, "upcoming")).Items, r => { Assert.Null(r.Recommendation); Assert.Null(r.OverallRating); });
    }

    [Fact]
    public async Task Only_the_users_own_evaluation_and_interviews_appear_never_a_colleagues()
    {
        var (me, _, _, submitted, _) = Mine();
        var colleague = Data.AddUser(Roles.Interviewer);
        var other = Data.AddCandidate();
        var theirs = Data.AddInterview(other.Id, colleague.Id, me.Id);
        theirs.ScheduledAt = Now.AddHours(-10);
        Db.SaveChanges();
        Data.AddSubmittedEvaluation(theirs.Id, colleague.Id, overallRating: 1, recommendation: "Reject");
        var notMine = Book(Data.AddCandidate(), colleague, -10);

        var awaiting = await History(me, "awaiting");

        // The colleague's submitted evaluation is not mine, so on a shared interview mine is still outstanding.
        Assert.Contains(theirs.Id, awaiting.Items.Select(i => i.Id));
        Assert.All(awaiting.Items, r => Assert.Null(r.Recommendation));
        Assert.DoesNotContain(notMine.Id, (await History(me, "awaiting")).Items.Select(i => i.Id));
        Assert.DoesNotContain(notMine.Id, (await History(me, "upcoming")).Items.Select(i => i.Id));
        Assert.Equal(submitted.Id, (await History(me, "submitted")).Items.Single().Id);
    }

    [Fact]
    public async Task Upcoming_is_soonest_first_and_the_others_most_recent_first()
    {
        var me = Data.AddUser(Roles.Interviewer);
        var later = Book(Data.AddCandidate(), me, +96);
        var sooner = Book(Data.AddCandidate(), me, +24);
        var olderPast = Book(Data.AddCandidate(), me, -96);
        var newerPast = Book(Data.AddCandidate(), me, -24);

        Assert.Equal([sooner.Id, later.Id], (await History(me, "upcoming")).Items.Select(i => i.Id));
        Assert.Equal([newerPast.Id, olderPast.Id], (await History(me, "awaiting")).Items.Select(i => i.Id));
    }

    [Fact]
    public async Task Search_matches_the_candidate_name_ignoring_case_and_narrows_the_total()
    {
        var me = Data.AddUser(Roles.Interviewer);
        var ada = Data.AddCandidate();
        ada.FullName = "Ada Lovelace";
        var grace = Data.AddCandidate();
        grace.FullName = "Grace Hopper";
        Db.SaveChanges();
        var adaInterview = Book(ada, me, -10);
        Book(grace, me, -20);

        var result = await History(me, "awaiting", search: "LOVE");

        Assert.Equal([adaInterview.Id], result.Items.Select(i => i.Id));
        Assert.Equal(1, result.TotalCount);
        Assert.Equal(2, result.Counts.Awaiting); // counts ignore the search, they describe the tabs
    }

    [Fact]
    public async Task Paging_returns_a_window_and_reports_the_total()
    {
        var me = Data.AddUser(Roles.Interviewer);
        for (var i = 1; i <= 5; i++) Book(Data.AddCandidate(), me, -i * 10);

        var first = await History(me, "awaiting", page: 1, pageSize: 2);
        var third = await History(me, "awaiting", page: 3, pageSize: 2);

        Assert.Equal(2, first.Items.Count);
        Assert.Equal(5, first.TotalCount);
        Assert.Single(third.Items);
    }

    [Theory]
    [InlineData(0, 0, 1, 1)]
    [InlineData(-4, -9, 1, 1)]
    [InlineData(2, 100000, 2, 100)]
    public async Task Paging_is_clamped_and_the_applied_values_are_reported(int page, int pageSize, int appliedPage, int appliedSize)
    {
        var me = Data.AddUser(Roles.Interviewer);
        Book(Data.AddCandidate(), me, -10);

        var result = await History(me, "awaiting", page: page, pageSize: pageSize);

        Assert.Equal(appliedPage, result.Page);
        Assert.Equal(appliedSize, result.PageSize);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("nonsense")]
    public async Task An_unknown_or_missing_tab_falls_back_to_upcoming(string? tab)
    {
        var (me, upcoming, _, _, _) = Mine();

        Assert.Equal([upcoming.Id], (await History(me, tab)).Items.Select(i => i.Id));
    }

    [Fact]
    public async Task A_user_with_no_interviews_gets_empty_tabs_and_zero_counts()
    {
        var me = Data.AddUser(Roles.Recruiter);

        var result = await History(me, "awaiting");

        Assert.Empty(result.Items);
        Assert.Equal(new MyInterviewCountsDto(0, 0, 0, 0), result.Counts);
    }
}

/// <summary>The same over the real HTTP pipeline, for the roles a user can hold.</summary>
[Collection(ApiCollection.Name)]
public class MyInterviewHistoryApiTests(ApiFixture fx)
{
    private async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(string email, string query)
    {
        var resp = await fx.SendAsync(HttpMethod.Get, $"/api/interviews/mine/history{query}", await fx.LoginAsync(email));
        var text = await resp.Content.ReadAsStringAsync();
        return (resp.StatusCode, text.StartsWith('{') ? JsonDocument.Parse(text).RootElement.Clone() : default);
    }

    [Theory]
    [InlineData("interviewer")]
    [InlineData("recruiter")]
    [InlineData("admin")]
    public async Task Every_role_can_open_its_own_history(string who)
    {
        var email = who switch { "interviewer" => fx.InterviewerEmail, "recruiter" => fx.RecruiterEmail, _ => fx.AdminEmail };

        var (status, body) = await GetAsync(email, "?tab=awaiting");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(body.TryGetProperty("counts", out _));
    }

    [Fact]
    public async Task An_assigned_interviewer_sees_their_interview_and_an_anonymous_caller_is_refused()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: true);

        var (status, body) = await GetAsync(fx.InterviewerEmail, "?tab=upcoming&pageSize=100");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Contains(body.GetProperty("items").EnumerateArray(), r => r.GetProperty("id").GetInt32() == interviewId);

        var anonymous = await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine/history", null);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [Fact]
    public async Task The_dashboards_unpaged_list_is_unchanged()
    {
        var resp = await fx.SendAsync(HttpMethod.Get, "/api/interviews/mine", await fx.LoginAsync(fx.InterviewerEmail));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.StartsWith("[", await resp.Content.ReadAsStringAsync());
    }
}
