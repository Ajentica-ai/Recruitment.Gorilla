using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Overdue evaluation reminders (#202): an interviewer who has not submitted is nudged once the interview ended
/// <c>AfterHours</c> ago, at most once per <c>IntervalHours</c>, at most <c>MaxReminders</c> times.
/// </summary>
public class EvaluationReminderTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Title = "Evaluation reminder";
    private static readonly DateTime Now = new(2026, 10, 25, 12, 0, 0, DateTimeKind.Utc);

    private EvaluationReminderService Reminders(EvaluationReminderOptions? options = null) =>
        new(Db, Notifications(), Options.Create(options ?? new EvaluationReminderOptions()));

    /// <summary>An interview that ended <paramref name="endedHoursAgo"/> hours before <see cref="Now"/>.</summary>
    private (Candidate Candidate, Interview Interview, User Interviewer) Ended(double endedHoursAgo, int durationMinutes = 60)
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(status: "Interview Scheduled");
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.DurationMinutes = durationMinutes;
        interview.ScheduledAt = Now.AddHours(-endedHoursAgo).AddMinutes(-durationMinutes);
        Db.SaveChanges();
        return (candidate, interview, interviewer);
    }

    private int Sent(User user) => Db.Notifications.Count(n => n.UserId == user.Id && n.Title == Title);

    [Fact]
    public async Task An_interviewer_is_reminded_once_the_interview_ended_long_enough_ago()
    {
        var (candidate, interview, interviewer) = Ended(endedHoursAgo: 25);

        var count = await Reminders().SendDueAsync(Now);

        Assert.Equal(1, count);
        var notice = Db.Notifications.Single(n => n.UserId == interviewer.Id && n.Title == Title);
        Assert.Equal($"/interviews/{interview.Id}", notice.LinkUrl);
        Assert.Contains(candidate.FullName, notice.Message);
    }

    [Fact]
    public async Task Nobody_is_reminded_before_the_wait_is_over_and_the_end_time_counts_not_the_start()
    {
        var (_, _, early) = Ended(endedHoursAgo: 23);
        // Started 25h ago but ran 3h, so it only ended 22h ago.
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var longOne = Data.AddInterview(candidate.Id, interviewer.Id);
        longOne.DurationMinutes = 180;
        longOne.ScheduledAt = Now.AddHours(-25);
        Db.SaveChanges();

        Assert.Equal(0, await Reminders().SendDueAsync(Now));

        Assert.Equal(0, Sent(early));
        Assert.Equal(0, Sent(interviewer));
    }

    [Fact]
    public async Task A_second_reminder_waits_for_the_interval_and_stops_at_the_maximum()
    {
        var (_, _, interviewer) = Ended(endedHoursAgo: 25);
        var service = Reminders(new EvaluationReminderOptions { IntervalHours = 24, MaxReminders = 2 });

        await service.SendDueAsync(Now);
        await service.SendDueAsync(Now.AddHours(23));          // inside the interval
        Assert.Equal(1, Sent(interviewer));

        await service.SendDueAsync(Now.AddHours(24));          // interval over: second
        Assert.Equal(2, Sent(interviewer));

        await service.SendDueAsync(Now.AddHours(48));          // at the maximum already
        await service.SendDueAsync(Now.AddHours(96));
        Assert.Equal(2, Sent(interviewer));
    }

    [Fact]
    public async Task Only_interviewers_without_a_submitted_evaluation_are_reminded_a_draft_does_not_count()
    {
        var done = Data.AddUser(Roles.Interviewer);
        var draft = Data.AddUser(Roles.Interviewer);
        var missing = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, done.Id, draft.Id, missing.Id);
        interview.ScheduledAt = Now.AddHours(-30);
        Data.AddSubmittedEvaluation(interview.Id, done.Id);
        Db.InterviewEvaluations.Add(new InterviewEvaluation { InterviewId = interview.Id, InterviewerUserId = draft.Id, IsSubmitted = false });
        Db.SaveChanges();

        await Reminders().SendDueAsync(Now);

        Assert.Equal(0, Sent(done));
        Assert.Equal(1, Sent(draft));
        Assert.Equal(1, Sent(missing));
    }

    [Fact]
    public async Task A_cancelled_interview_sends_nothing()
    {
        var (_, interview, interviewer) = Ended(endedHoursAgo: 48);
        interview.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        Assert.Equal(0, await Reminders().SendDueAsync(Now));
        Assert.Equal(0, Sent(interviewer));
    }

    [Fact]
    public async Task A_deactivated_interviewer_is_not_reminded()
    {
        var (_, _, interviewer) = Ended(endedHoursAgo: 48);
        interviewer.IsActive = false;
        Db.SaveChanges();

        Assert.Equal(0, await Reminders().SendDueAsync(Now));
    }

    [Fact]
    public async Task A_future_interview_sends_nothing()
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.ScheduledAt = Now.AddDays(2);
        Db.SaveChanges();

        Assert.Equal(0, await Reminders().SendDueAsync(Now));
    }

    [Fact]
    public async Task Reminders_can_be_switched_off()
    {
        var (_, _, interviewer) = Ended(endedHoursAgo: 48);

        Assert.Equal(0, await Reminders(new EvaluationReminderOptions { Enabled = false }).SendDueAsync(Now));
        Assert.Equal(0, Sent(interviewer));
    }

    [Fact]
    public async Task The_wait_comes_from_the_options()
    {
        var (_, _, interviewer) = Ended(endedHoursAgo: 5);

        Assert.Equal(0, await Reminders(new EvaluationReminderOptions { AfterHours = 6 }).SendDueAsync(Now));
        Assert.Equal(1, await Reminders(new EvaluationReminderOptions { AfterHours = 4 }).SendDueAsync(Now));
        Assert.Equal(1, Sent(interviewer));
    }

    [Fact]
    public async Task An_interview_with_no_panel_is_skipped()
    {
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id);
        interview.ScheduledAt = Now.AddDays(-3);
        Db.SaveChanges();

        Assert.Equal(0, await Reminders().SendDueAsync(Now));
    }

    [Fact]
    public async Task Reminders_are_tracked_per_interviewer_and_interview()
    {
        var (_, first, interviewer) = Ended(endedHoursAgo: 30);
        var secondCandidate = Data.AddCandidate();
        var second = Data.AddInterview(secondCandidate.Id, interviewer.Id);
        second.ScheduledAt = Now.AddHours(-40);
        Db.SaveChanges();
        var service = Reminders();

        await service.SendDueAsync(Now);

        Assert.Equal(2, Sent(interviewer));
        var rows = Db.EvaluationReminders.Where(r => r.UserId == interviewer.Id).OrderBy(r => r.InterviewId).ToList();
        Assert.Equal(new[] { first.Id, second.Id }.Order(), rows.Select(r => r.InterviewId).Order());
        Assert.All(rows, r => Assert.Equal(1, r.Count));
    }
}

/// <summary>"All evaluations in" (#202): the booker and the recruiters who can see the candidate hear once the last panelist submits.</summary>
public class AllEvaluationsInTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Title = "All evaluations in";

    private async Task SubmitAsync(Interview interview, User user)
    {
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();
        var (dto, error, _, _) = await Interviews().UpsertEvaluationAsync(
            interview.Id, user.Id, new UpsertEvaluationDto(null, "Recommended", null, 4, items, true));
        Assert.Null(error);
        Assert.True(dto!.IsSubmitted);
    }

    private int Heard(User user) => Db.Notifications.Count(n => n.UserId == user.Id && n.Title == Title);

    private (Candidate Candidate, Interview Interview, User A, User B, User Booker) Panel()
    {
        var booker = Data.AddUser(Roles.Recruiter);
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(ownerUserId: booker.Id, status: "Interview Scheduled");
        var interview = Data.AddInterview(candidate.Id, a.Id, b.Id);
        interview.CreatedByUserId = booker.Id;
        Db.SaveChanges();
        return (candidate, interview, a, b, booker);
    }

    [Fact]
    public async Task Nobody_hears_until_the_last_panelist_has_submitted()
    {
        var (_, interview, a, b, booker) = Panel();

        await SubmitAsync(interview, a);
        Assert.Equal(0, Heard(booker));

        await SubmitAsync(interview, b);
        Assert.Equal(1, Heard(booker));
    }

    [Fact]
    public async Task It_links_to_the_evaluation_report_and_names_the_candidate()
    {
        var (candidate, interview, a, b, booker) = Panel();
        await SubmitAsync(interview, a);
        await SubmitAsync(interview, b);

        var notice = Db.Notifications.Single(n => n.UserId == booker.Id && n.Title == Title);

        Assert.Equal($"/candidates/{candidate.Id}/evaluations", notice.LinkUrl);
        Assert.Contains(candidate.FullName, notice.Message);
    }

    [Fact]
    public async Task The_booker_and_in_scope_recruiters_hear_but_not_other_recruiters_admins_or_the_submitter()
    {
        var (candidate, interview, a, b, booker) = Panel();
        var role = Data.AddRole(null, null);
        var assigned = Data.AddUser(Roles.Recruiter);
        Db.RoleRecruiters.Add(new RoleRecruiter { RoleAppliedOptionId = role.Id, UserId = assigned.Id });
        candidate.RoleAppliedOptionId = role.Id;
        var stranger = Data.AddUser(Roles.Recruiter);
        var admin = Data.AddUser(Roles.Admin);
        Db.SaveChanges();

        await SubmitAsync(interview, a);
        await SubmitAsync(interview, b);

        Assert.Equal(1, Heard(booker));
        Assert.Equal(1, Heard(assigned));
        Assert.Equal(0, Heard(stranger));
        Assert.Equal(0, Heard(admin));
        Assert.Equal(0, Heard(a));
        Assert.Equal(0, Heard(b));
    }

    [Fact]
    public async Task A_booker_who_can_no_longer_see_the_candidate_is_not_sent_a_dead_link()
    {
        var (candidate, interview, a, b, booker) = Panel();
        var newOwner = Data.AddUser(Roles.Recruiter);
        candidate.OwnerUserId = newOwner.Id; // the booker is no longer the owner and is not assigned to an opening
        Db.SaveChanges();

        await SubmitAsync(interview, a);
        await SubmitAsync(interview, b);

        Assert.Equal(0, Heard(booker));
        Assert.Equal(1, Heard(newOwner));
    }

    [Fact]
    public async Task An_admin_booker_hears_for_any_candidate()
    {
        var admin = Data.AddUser(Roles.Admin);
        var a = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, a.Id);
        interview.CreatedByUserId = admin.Id;
        Db.SaveChanges();

        await SubmitAsync(interview, a);

        Assert.Equal(1, Heard(admin));
    }

    [Fact]
    public async Task A_booker_who_is_also_the_owner_is_told_once()
    {
        var (_, interview, a, b, booker) = Panel();

        await SubmitAsync(interview, a);
        await SubmitAsync(interview, b);

        Assert.Equal(1, Heard(booker));
    }

    [Fact]
    public async Task A_single_interviewer_panel_fires_on_their_submit()
    {
        var booker = Data.AddUser(Roles.Recruiter);
        var only = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(ownerUserId: booker.Id);
        var interview = Data.AddInterview(candidate.Id, only.Id);
        interview.CreatedByUserId = booker.Id;
        Db.SaveChanges();

        await SubmitAsync(interview, only);

        Assert.Equal(1, Heard(booker));
    }

    [Fact]
    public async Task Saving_a_draft_never_fires_it()
    {
        var (_, interview, a, b, booker) = Panel();
        Data.AddSubmittedEvaluation(interview.Id, a.Id);
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();

        await Interviews().UpsertEvaluationAsync(interview.Id, b.Id, new UpsertEvaluationDto(null, "Recommended", null, 4, items, false));

        Assert.Equal(0, Heard(booker));
    }
}
