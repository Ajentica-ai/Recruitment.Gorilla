using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>Bad settings and old interviews must not cause early or runaway reminders (#202 review).</summary>
public class EvaluationReminderLimitsTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static readonly DateTime Now = new(2026, 10, 25, 12, 0, 0, DateTimeKind.Utc);

    private EvaluationReminderService Reminders(EvaluationReminderOptions o) =>
        new(Db, Notifications(), Options.Create(o));

    private (Interview Interview, User Interviewer) Interview(double startedHoursAgo)
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate();
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.ScheduledAt = Now.AddHours(-startedHoursAgo);
        Db.SaveChanges();
        return (interview, interviewer);
    }

    [Fact]
    public async Task A_negative_wait_does_not_remind_before_the_interview_has_ended()
    {
        var (_, interviewer) = Interview(startedHoursAgo: -2); // two hours in the future

        await Reminders(new EvaluationReminderOptions { AfterHours = -100 }).SendDueAsync(Now);

        Assert.Equal(0, Db.Notifications.Count(n => n.UserId == interviewer.Id));
    }

    [Fact]
    public async Task A_zero_interval_cannot_send_on_every_poll()
    {
        var (_, interviewer) = Interview(startedHoursAgo: 40);
        var service = Reminders(new EvaluationReminderOptions { IntervalHours = 0, MaxReminders = 10 });

        await service.SendDueAsync(Now);
        await service.SendDueAsync(Now.AddMinutes(15));
        await service.SendDueAsync(Now.AddMinutes(30));

        Assert.Equal(1, Db.Notifications.Count(n => n.UserId == interviewer.Id && n.Title == "Evaluation reminder"));
    }

    [Fact]
    public async Task An_interview_older_than_the_lookback_is_left_alone()
    {
        var (_, interviewer) = Interview(startedHoursAgo: 24 * 20);

        Assert.Equal(0, await Reminders(new EvaluationReminderOptions()).SendDueAsync(Now));
        Assert.Equal(0, Db.Notifications.Count(n => n.UserId == interviewer.Id));
    }

    [Fact]
    public async Task A_deactivated_panelist_does_not_stop_all_evaluations_in()
    {
        var booker = Data.AddUser(Roles.Recruiter);
        var active = Data.AddUser(Roles.Interviewer);
        var gone = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(ownerUserId: booker.Id);
        var interview = Data.AddInterview(candidate.Id, active.Id, gone.Id);
        interview.CreatedByUserId = booker.Id;
        gone.IsActive = false;
        Db.SaveChanges();
        var items = EvaluationCriteria.Keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList();

        await Interviews().UpsertEvaluationAsync(interview.Id, active.Id, new UpsertEvaluationDto(null, "Recommended", null, 4, items, true));

        Assert.Equal(1, Db.Notifications.Count(n => n.UserId == booker.Id && n.Title == "All evaluations in"));
    }
}
