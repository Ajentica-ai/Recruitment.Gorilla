using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// #263: a Recruiter or Super Admin may book or move an interview to a time that has already passed, with a
/// reason; an Admin may not. A past time is recorded as its own event and sends nothing outward.
/// </summary>
public class BackdatedInterviewServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Scheduled = "Interview Scheduled";
    private const string CallForInterview = "Call for Interview";

    /// <summary>
    /// A candidate at Interview Scheduled whose history reads: added 30 days ago, Call for Interview 20 days ago,
    /// Interview Scheduled 10 days ago, with one booked interviewer.
    /// </summary>
    private async Task<(Candidate Candidate, Interview Interview, User Interviewer, User Actor)> BookedAsync()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var actor = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(status: Scheduled, priorStatuses: CallForInterview);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        var tracked = await Db.Candidates.Include(c => c.StatusHistories).FirstAsync(c => c.Id == candidate.Id);
        tracked.CreatedAt = DateTime.UtcNow.AddDays(-30);
        tracked.StatusHistories.First(h => h.Status == CallForInterview).ChangedAt = DateTime.UtcNow.AddDays(-20);
        tracked.StatusHistories.First(h => h.Status == Scheduled).ChangedAt = DateTime.UtcNow.AddDays(-10);
        await Db.SaveChangesAsync();
        return (candidate, interview, interviewer, actor);
    }

    private static RescheduleInterviewDto Move(
        DateTime at, List<int> interviewerIds, string? reason = "It actually took place then") =>
        new(at, 45, null, interviewerIds, null, reason);

    private InterviewService InterviewsWithSlack(ScriptedSlackTransport slack) => new(
        Db, Candidates(),
        new NotificationService(Db, TestEmail(), TestSlack(slack, new FakeSlackSettingsResolver(
            "xoxb-test", NotificationCategories.InterviewAssigned, NotificationCategories.InterviewRescheduled))),
        Audit(), TestConfig(), PanelAutoShare());

    // ----- Reschedule: who may go to the past -----

    [Fact]
    public async Task A_recruiter_or_super_admin_can_move_a_booking_to_the_past_with_a_reason()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();
        var originalAt = interview.ScheduledAt;
        var past = DateTime.UtcNow.AddDays(-2).Date.AddHours(9);

        var (dto, error, notFound, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(past, [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);

        Assert.Null(error);
        Assert.False(notFound);
        Assert.False(conflict);
        Assert.Equal(past, dto!.ScheduledAt, TimeSpan.FromSeconds(1));

        var saved = await Db.Interviews.AsNoTracking().FirstAsync(i => i.Id == interview.Id);
        Assert.Equal(past, saved.ScheduledAt, TimeSpan.FromSeconds(1));

        var ev = await Db.InterviewEvents.AsNoTracking().SingleAsync(e => e.InterviewId == interview.Id);
        Assert.Equal(InterviewEventTypes.RescheduledBackdated, ev.EventType);
        Assert.Equal(originalAt, ev.PreviousScheduledAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal(past, ev.NewScheduledAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal("It actually took place then", ev.Reason);
        Assert.Equal(actor.Name, ev.ActorName);
    }

    [Fact]
    public async Task A_past_time_without_a_reason_is_refused_and_nothing_moves()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();
        var originalAt = interview.ScheduledAt;

        foreach (var reason in new string?[] { null, "", "   " })
        {
            var (_, error, _, _) = await Interviews().RescheduleAsync(
                interview.Id, Move(DateTime.UtcNow.AddDays(-2), [interviewer.Id], reason), null, actor.Id, actor.Name,
                canBackdate: true);
            Assert.Contains("reason", error, StringComparison.OrdinalIgnoreCase);
        }

        var saved = await Db.Interviews.AsNoTracking().FirstAsync(i => i.Id == interview.Id);
        Assert.Equal(originalAt, saved.ScheduledAt, TimeSpan.FromSeconds(1));
        Assert.Empty(await Db.InterviewEvents.Where(e => e.InterviewId == interview.Id).ToListAsync());
    }

    [Fact]
    public async Task Without_the_backdate_permission_a_past_time_is_still_refused()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-2), [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.Equal("Pick a time in the future.", error);
    }

    [Fact]
    public async Task A_future_time_is_a_normal_reschedule_even_for_someone_who_may_backdate()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(4), [interviewer.Id], reason: null), null, actor.Id, actor.Name,
            canBackdate: true);

        Assert.Null(error);
        var ev = await Db.InterviewEvents.AsNoTracking().SingleAsync(e => e.InterviewId == interview.Id);
        Assert.Equal(InterviewEventTypes.Rescheduled, ev.EventType);
    }

    // ----- Reschedule: lower bounds -----

    [Fact]
    public async Task A_time_before_the_candidate_was_added_is_refused()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-40), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);

        Assert.Contains("before the candidate was added", error);
    }

    [Fact]
    public async Task A_time_before_the_status_the_interview_follows_is_refused_but_one_after_it_is_allowed()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        var (_, tooEarly, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-25), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);
        Assert.Contains(CallForInterview, tooEarly);

        // Between Call for Interview (20 days ago) and the booking being recorded (10 days ago): it happened before
        // anyone entered it, which is the case this feature exists for.
        var (_, ok, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-15), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);
        Assert.Null(ok);
    }

    // ----- Reschedule: existing guards still apply -----

    [Fact]
    public async Task The_existing_guards_still_apply_to_a_past_time()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id);

        var (_, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-2), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);

        Assert.True(conflict);
        Assert.Contains("submitted evaluation", error);
    }

    // ----- Nothing goes outward for a time that has passed -----

    [Fact]
    public async Task A_past_reschedule_sends_no_email_slack_or_calendar_invite_only_an_in_app_notice()
    {
        var (_, interview, keeper, actor) = await BookedAsync();
        var newcomer = Data.AddUser(Roles.Interviewer);
        var emailsBefore = await Db.OutboundEmails.CountAsync();
        var slack = new ScriptedSlackTransport(_ => null);

        var (_, error, _, _) = await InterviewsWithSlack(slack).RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-2), [keeper.Id, newcomer.Id]), null, actor.Id, actor.Name,
            canBackdate: true);

        Assert.Null(error);
        Assert.Equal(emailsBefore, await Db.OutboundEmails.CountAsync());
        Assert.Empty(slack.PostedTexts);
        foreach (var uid in new[] { keeper.Id, newcomer.Id })
            Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == uid && n.LinkUrl == $"/interviews/{interview.Id}"));
    }

    [Fact]
    public async Task A_future_reschedule_still_emails_with_the_calendar_invite()
    {
        var (_, interview, keeper, actor) = await BookedAsync();
        var slack = new ScriptedSlackTransport(_ => null);

        await InterviewsWithSlack(slack).RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(3), [keeper.Id], "moved"), null, actor.Id, actor.Name, canBackdate: true);

        var mail = await Db.OutboundEmails.AsNoTracking().Where(e => e.ToEmail == keeper.Email).ToListAsync();
        Assert.NotEmpty(mail);
        Assert.All(mail, m => Assert.NotNull(m.CalendarContent));
        Assert.NotEmpty(slack.PostedTexts);
    }

    // ----- Evaluation reminders treat the back-dated time as the interview time -----

    private EvaluationReminderService Reminders() =>
        new(Db, Notifications(), Microsoft.Extensions.Options.Options.Create(new EvaluationReminderOptions()));

    [Fact]
    public async Task A_back_dated_interview_is_reminded_about_its_missing_evaluation_as_overdue()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        // Booked for the future, so nothing is due yet.
        Assert.Equal(0, await Reminders().SendDueAsync(DateTime.UtcNow));

        await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-2), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);

        Assert.Equal(1, await Reminders().SendDueAsync(DateTime.UtcNow));
        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == interviewer.Id && n.Title == "Evaluation reminder"));
    }

    [Fact]
    public async Task A_back_dated_interview_older_than_the_reminder_lookback_is_left_alone()
    {
        var (_, interview, interviewer, actor) = await BookedAsync();

        await Interviews().RescheduleAsync(
            interview.Id, Move(DateTime.UtcNow.AddDays(-16), [interviewer.Id]), null, actor.Id, actor.Name, canBackdate: true);

        Assert.Equal(0, await Reminders().SendDueAsync(DateTime.UtcNow));
    }

    // ----- Add Status: the first booking -----

    private static StatusChangeDto Booking(DateTime at, int interviewerId, string? comment = null) =>
        new(Scheduled, comment, null, null, at, [interviewerId], null);

    private async Task<(Candidate Candidate, User Interviewer)> ReadyToBookAsync()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(status: CallForInterview);
        var tracked = await Db.Candidates.Include(c => c.StatusHistories).FirstAsync(c => c.Id == candidate.Id);
        tracked.CreatedAt = DateTime.UtcNow.AddDays(-30);
        tracked.StatusHistories.First().ChangedAt = DateTime.UtcNow.AddDays(-20);
        await Db.SaveChangesAsync();
        return (candidate, interviewer);
    }

    [Fact]
    public async Task Booking_in_the_past_is_a_validation_error_for_an_admin()
    {
        var (c, interviewer) = await ReadyToBookAsync();

        var error = await Candidates().ValidateStatusChangeAsync(c.Id, Booking(DateTime.UtcNow.AddDays(-2), interviewer.Id, "why"));

        Assert.Equal("Pick a time in the future.", error);
    }

    [Fact]
    public async Task Booking_in_the_past_needs_a_comment_as_the_reason_for_a_recruiter_or_super_admin()
    {
        var (c, interviewer) = await ReadyToBookAsync();

        var none = await Candidates().ValidateStatusChangeAsync(
            c.Id, Booking(DateTime.UtcNow.AddDays(-2), interviewer.Id), canBackdate: true);
        Assert.Contains("reason", none, StringComparison.OrdinalIgnoreCase);

        var ok = await Candidates().ValidateStatusChangeAsync(
            c.Id, Booking(DateTime.UtcNow.AddDays(-2), interviewer.Id, "Held by phone, entered late"), canBackdate: true);
        Assert.Null(ok);
    }

    [Fact]
    public async Task Booking_before_the_candidate_was_added_or_before_the_current_status_is_refused()
    {
        var (c, interviewer) = await ReadyToBookAsync();

        var beforeAdded = await Candidates().ValidateStatusChangeAsync(
            c.Id, Booking(DateTime.UtcNow.AddDays(-40), interviewer.Id, "x"), canBackdate: true);
        Assert.Contains("before the candidate was added", beforeAdded);

        var beforeStatus = await Candidates().ValidateStatusChangeAsync(
            c.Id, Booking(DateTime.UtcNow.AddDays(-25), interviewer.Id, "x"), canBackdate: true);
        Assert.Contains(CallForInterview, beforeStatus);
    }

    [Fact]
    public async Task A_future_booking_needs_no_reason_and_is_unchanged()
    {
        var (c, interviewer) = await ReadyToBookAsync();

        Assert.Null(await Candidates().ValidateStatusChangeAsync(c.Id, Booking(DateTime.UtcNow.AddDays(3), interviewer.Id)));
    }

    [Fact]
    public async Task A_past_booking_is_saved_and_sends_nothing_outward()
    {
        var (c, interviewer) = await ReadyToBookAsync();
        var emailsBefore = await Db.OutboundEmails.CountAsync();
        var past = DateTime.UtcNow.AddDays(-2);

        var entry = await Candidates().AddStatusAsync(
            c.Id, Booking(past, interviewer.Id, "Held by phone, entered late"), "Rhonda Recruiter", null);

        Assert.NotNull(entry);
        Assert.Equal(emailsBefore, await Db.OutboundEmails.CountAsync());
        var opening = await Db.InterviewEvents.AsNoTracking().SingleAsync(e => e.InterviewId == entry!.InterviewId);
        Assert.Equal(InterviewEventTypes.Scheduled, opening.EventType);
        Assert.Equal("Held by phone, entered late", opening.Reason);
        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == interviewer.Id && n.LinkUrl == $"/interviews/{entry!.InterviewId}"));
    }

    [Fact]
    public async Task A_future_booking_still_emails_the_interviewer()
    {
        var (c, interviewer) = await ReadyToBookAsync();

        await Candidates().AddStatusAsync(c.Id, Booking(DateTime.UtcNow.AddDays(3), interviewer.Id), "Rhonda Recruiter", null);

        Assert.True(await Db.OutboundEmails.AnyAsync(e => e.ToEmail == interviewer.Email));
    }
}
