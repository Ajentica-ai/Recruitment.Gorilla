using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// InterviewService.RescheduleAsync / CancelAsync / GetScheduleAsync (issue #173) — the rules that
/// decide whether a booking may move, what the move does to the candidate, and what it leaves behind.
/// </summary>
public class InterviewScheduleServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Scheduled = "Interview Scheduled";
    private const string CallForInterview = "Call for Interview";

    /// <summary>A candidate sitting at Interview Scheduled with one booked interviewer.</summary>
    private (Candidate Candidate, Interview Interview, User Interviewer, User Actor) Booked(
        string candidateStatus = Scheduled)
    {
        var interviewer = Data.AddUser(Roles.Interviewer);
        var actor = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(status: candidateStatus);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        return (candidate, interview, interviewer, actor);
    }

    private static RescheduleInterviewDto Move(
        DateTime? at = null, List<int>? interviewerIds = null, int duration = 45,
        string? notes = null, string? reason = "Candidate asked for a later slot") =>
        new(at ?? DateTime.UtcNow.AddDays(5), duration, notes, interviewerIds ?? [], null, reason);

    // ----- Reschedule -----

    [Fact]
    public async Task Reschedule_moves_the_time_records_an_event_and_bumps_the_calendar_sequence()
    {
        var (_, interview, interviewer, actor) = Booked();
        var originalAt = interview.ScheduledAt;
        var target = DateTime.UtcNow.AddDays(6).Date.AddHours(10);

        var (dto, error, notFound, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(at: target, interviewerIds: [interviewer.Id]),
            ownerScope: null, actor.Id, actor.Name);

        Assert.Null(error);
        Assert.False(notFound);
        Assert.False(conflict);
        Assert.NotNull(dto);
        Assert.Equal(target, dto!.ScheduledAt, TimeSpan.FromSeconds(1));
        Assert.Equal(45, dto.DurationMinutes);

        var saved = await Db.Interviews.AsNoTracking().FirstAsync(i => i.Id == interview.Id);
        Assert.Equal(target, saved.ScheduledAt, TimeSpan.FromSeconds(1));
        // Clients ignore a re-issued invite for a known UID unless SEQUENCE has grown.
        Assert.Equal(1, saved.CalendarSequence);
        Assert.Equal(actor.Id, saved.UpdatedByUserId);
        Assert.NotNull(saved.UpdatedAt);

        var moved = await Db.InterviewEvents.AsNoTracking()
            .SingleAsync(e => e.InterviewId == interview.Id && e.EventType == InterviewEventTypes.Rescheduled);
        Assert.Equal(originalAt, moved.PreviousScheduledAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal(target, moved.NewScheduledAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal(actor.Name, moved.ActorName);
    }

    [Fact]
    public async Task Reschedule_leaves_the_candidates_status_and_history_alone()
    {
        var (candidate, interview, interviewer, actor) = Booked();
        var historyBefore = await Db.StatusHistories.CountAsync(h => h.CandidateId == candidate.Id);

        await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        // StatusHistory means "the candidate's status became X at time T". A reschedule changes
        // neither, and re-asserting it would corrupt every HasStatus / ordering / Take(1) reader.
        Assert.Equal(historyBefore, await Db.StatusHistories.CountAsync(h => h.CandidateId == candidate.Id));
        var saved = await Db.Candidates.AsNoTracking().FirstAsync(c => c.Id == candidate.Id);
        Assert.Equal(Scheduled, saved.CurrentStatus);
    }

    [Fact]
    public async Task A_submitted_evaluation_blocks_the_reschedule()
    {
        var (_, interview, interviewer, actor) = Booked();
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id);

        var (_, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.True(conflict);
        // The interview happened: the way to a new date is another round via Interview Completed.
        Assert.Contains("Interview Completed", error);
    }

    [Fact]
    public async Task Dropping_an_interviewer_deletes_their_draft_evaluation()
    {
        var (candidate, _, keeper, actor) = Booked();
        var leaver = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, keeper.Id, leaver.Id);

        Db.InterviewEvaluations.Add(new InterviewEvaluation
        {
            InterviewId = interview.Id,
            InterviewerUserId = leaver.Id,
            GeneralAssessment = "half-written notes",
        });
        await Db.SaveChangesAsync();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [keeper.Id]), null, actor.Id, actor.Name);

        Assert.Null(error);
        // The cascade runs from Interview, not the join row, so without an explicit delete the
        // draft survives and resurfaces the moment the interviewer is re-added.
        Assert.False(await Db.InterviewEvaluations
            .AnyAsync(e => e.InterviewId == interview.Id && e.InterviewerUserId == leaver.Id));
        Assert.False(await Db.InterviewInterviewers
            .AnyAsync(ii => ii.InterviewId == interview.Id && ii.UserId == leaver.Id));
    }

    [Fact]
    public async Task Added_and_removed_interviewers_are_both_applied()
    {
        var (candidate, _, keeper, actor) = Booked();
        var leaver = Data.AddUser(Roles.Interviewer);
        var joiner = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, keeper.Id, leaver.Id);

        var (dto, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [keeper.Id, joiner.Id]), null, actor.Id, actor.Name);

        Assert.Null(error);
        Assert.Equal([keeper.Id, joiner.Id], dto!.InterviewerUserIds.Order().ToList().Order().ToList());
        Assert.DoesNotContain(leaver.Id, dto.InterviewerUserIds);
    }

    [Fact]
    public async Task A_target_time_in_the_past_is_rejected()
    {
        var (_, interview, interviewer, actor) = Booked();

        var (_, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(at: DateTime.UtcNow.AddHours(-2), interviewerIds: [interviewer.Id]),
            null, actor.Id, actor.Name);

        Assert.False(conflict);
        Assert.Contains("future", error);
    }

    [Fact]
    public async Task Moving_an_interview_that_already_passed_is_allowed()
    {
        // The no-show case this feature exists for: the slot came and went, nobody held it.
        var (candidate, _, interviewer, actor) = Booked();
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.ScheduledAt = DateTime.UtcNow.AddDays(-3);
        await Db.SaveChangesAsync();

        var (dto, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.Null(error);
        Assert.False(conflict);
        Assert.NotNull(dto);
    }

    [Fact]
    public async Task At_least_one_interviewer_is_required()
    {
        var (_, interview, _, actor) = Booked();

        var (_, error, _, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: []), null, actor.Id, actor.Name);

        Assert.Contains("at least one interviewer", error);
    }

    [Fact]
    public async Task Reschedule_rejects_interview_types_that_are_not_active_options()
    {
        var (_, interview, interviewer, actor) = Booked();
        var inactive = new InterviewTypeOption { Name = "Retired round", IsActive = false };
        Db.InterviewTypeOptions.Add(inactive);
        await Db.SaveChangesAsync();

        foreach (var typeId in new[] { inactive.Id, int.MaxValue })
        {
            var (_, error, _, conflict) = await Interviews().RescheduleAsync(
                interview.Id,
                Move(interviewerIds: [interviewer.Id]) with { InterviewTypeOptionIds = [typeId] },
                null, actor.Id, actor.Name);

            Assert.False(conflict);
            Assert.Contains("valid active options", error);
        }

        Assert.Equal(0, (await Db.Interviews.FindAsync(interview.Id))!.CalendarSequence);
        Assert.False(await Db.InterviewEvents.AnyAsync(e => e.InterviewId == interview.Id));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Closed_role_blocks_interview_writes(bool cancel)
    {
        var role = Data.AddRole(endDate: DateTime.UtcNow.AddDays(-1));
        var interviewer = Data.AddUser(Roles.Interviewer);
        var actor = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(roleId: role.Id, status: Scheduled);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        var outcome = cancel
            ? await Interviews().CancelAsync(interview.Id, "No longer needed", null, actor.Id, actor.Name)
            : await Interviews().RescheduleAsync(
                interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.Contains("extend", outcome.Error);
        Assert.False(outcome.Conflict);
        Assert.Equal(InterviewStatuses.Scheduled, (await Db.Interviews.FindAsync(interview.Id))!.Status);
        Assert.Equal(Scheduled, (await Db.Candidates.FindAsync(candidate.Id))!.CurrentStatus);
        Assert.False(await Db.InterviewEvents.AnyAsync(e => e.InterviewId == interview.Id));
    }

    [Fact]
    public async Task Reschedule_rejects_notes_and_reason_longer_than_their_columns()
    {
        var (_, interview, interviewer, actor) = Booked();
        var request = Move(interviewerIds: [interviewer.Id]);

        var notes = await Interviews().RescheduleAsync(
            interview.Id, request with { Notes = new string('n', 4001) }, null, actor.Id, actor.Name);
        var reason = await Interviews().RescheduleAsync(
            interview.Id, request with { Reason = new string('r', 1001) }, null, actor.Id, actor.Name);

        Assert.Contains("4000", notes.Error);
        Assert.Contains("1000", reason.Error);
        Assert.Equal(0, (await Db.Interviews.FindAsync(interview.Id))!.CalendarSequence);
    }

    [Fact]
    public async Task Cancel_rejects_a_reason_longer_than_its_column()
    {
        var (_, interview, _, actor) = Booked();

        var outcome = await Interviews().CancelAsync(
            interview.Id, new string('r', 1001), null, actor.Id, actor.Name);

        Assert.Contains("1000", outcome.Error);
        Assert.Equal(InterviewStatuses.Scheduled, (await Db.Interviews.FindAsync(interview.Id))!.Status);
    }

    [Fact]
    public async Task A_candidate_past_Interview_Scheduled_cannot_have_the_booking_moved()
    {
        // Covers Rejected and Discontinued too: there is no live booking to move.
        var (_, interview, interviewer, actor) = Booked(candidateStatus: "Rejected");

        var (_, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.True(conflict);
        Assert.Contains("Rejected", error);
    }

    [Fact]
    public async Task A_recruiter_outside_the_candidates_scope_gets_not_found()
    {
        var owner = Data.AddUser(Roles.Recruiter);
        var stranger = Data.AddUser(Roles.Recruiter);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var candidate = Data.AddCandidate(ownerUserId: owner.Id, status: Scheduled);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        var (_, _, notFound, _) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), stranger.Id, stranger.Id, stranger.Name);

        Assert.True(notFound);
        var schedule = await Interviews().GetScheduleAsync(interview.Id, stranger.Id);
        Assert.True(schedule.NotFound);
    }

    // ----- Cancel -----

    [Fact]
    public async Task Cancel_marks_the_interview_records_the_event_and_returns_the_candidate_to_Call_for_Interview()
    {
        var (candidate, interview, _, actor) = Booked();

        var (dto, error, _, conflict) = await Interviews().CancelAsync(
            interview.Id, "Role was put on hold", null, actor.Id, actor.Name);

        Assert.Null(error);
        Assert.False(conflict);
        Assert.Equal(InterviewStatuses.Cancelled, dto!.Status);

        var saved = await Db.Interviews.AsNoTracking().FirstAsync(i => i.Id == interview.Id);
        Assert.Equal(InterviewStatuses.Cancelled, saved.Status);
        Assert.Equal(1, saved.CalendarSequence);

        var cancelled = await Db.InterviewEvents.AsNoTracking()
            .SingleAsync(e => e.InterviewId == interview.Id && e.EventType == InterviewEventTypes.Cancelled);
        Assert.Equal("Role was put on hold", cancelled.Reason);
        Assert.Null(cancelled.NewScheduledAt);

        // Unlike a reschedule, a cancel genuinely moves the candidate, so it does append history.
        var refreshed = await Db.Candidates.AsNoTracking().FirstAsync(c => c.Id == candidate.Id);
        Assert.Equal(CallForInterview, refreshed.CurrentStatus);
        Assert.True(await Db.StatusHistories
            .AnyAsync(h => h.CandidateId == candidate.Id && h.Status == CallForInterview));
    }

    [Fact]
    public async Task Cancelling_for_a_rejected_candidate_is_calendar_cleanup_and_does_not_revive_them()
    {
        // Allowed, because the invite is live in people's calendars. But stepping them back to
        // Call for Interview would silently un-reject them.
        var (candidate, interview, _, actor) = Booked(candidateStatus: "Rejected");

        var (dto, error, _, conflict) = await Interviews().CancelAsync(
            interview.Id, "Candidate withdrew", null, actor.Id, actor.Name);

        Assert.Null(error);
        Assert.False(conflict);
        Assert.Equal(InterviewStatuses.Cancelled, dto!.Status);

        var refreshed = await Db.Candidates.AsNoTracking().FirstAsync(c => c.Id == candidate.Id);
        Assert.Equal("Rejected", refreshed.CurrentStatus);
        Assert.False(await Db.StatusHistories
            .AnyAsync(h => h.CandidateId == candidate.Id && h.Status == CallForInterview));
    }

    [Fact]
    public async Task Cancel_requires_a_reason()
    {
        var (_, interview, _, actor) = Booked();

        var (_, error, _, conflict) = await Interviews().CancelAsync(
            interview.Id, "   ", null, actor.Id, actor.Name);

        Assert.False(conflict);
        Assert.Contains("reason is required", error);
    }

    [Fact]
    public async Task Cancelling_twice_is_refused()
    {
        var (_, interview, _, actor) = Booked();
        await Interviews().CancelAsync(interview.Id, "First", null, actor.Id, actor.Name);

        var (_, error, _, conflict) = await Interviews().CancelAsync(
            interview.Id, "Again", null, actor.Id, actor.Name);

        Assert.True(conflict);
        Assert.Contains("already been cancelled", error);
    }

    [Fact]
    public async Task A_cancelled_interview_cannot_be_rescheduled()
    {
        var (_, interview, interviewer, actor) = Booked();
        await Interviews().CancelAsync(interview.Id, "Slot gone", null, actor.Id, actor.Name);

        var (_, error, _, conflict) = await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id]), null, actor.Id, actor.Name);

        Assert.True(conflict);
        Assert.Contains("cancelled", error);
    }

    [Fact]
    public async Task A_submitted_evaluation_blocks_the_cancel()
    {
        var (_, interview, interviewer, actor) = Booked();
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id);

        var (_, _, _, conflict) = await Interviews().CancelAsync(
            interview.Id, "Too late", null, actor.Id, actor.Name);

        Assert.True(conflict);
    }

    [Fact]
    public async Task A_cancelled_interview_drops_out_of_my_interviews()
    {
        var (_, interview, interviewer, actor) = Booked();
        Assert.Contains(await Interviews().GetMineAsync(interviewer.Id), m => m.Id == interview.Id);

        await Interviews().CancelAsync(interview.Id, "Called off", null, actor.Id, actor.Name);

        Assert.DoesNotContain(await Interviews().GetMineAsync(interviewer.Id), m => m.Id == interview.Id);
    }

    // ----- Schedule read model -----

    [Fact]
    public async Task The_schedule_read_model_carries_the_prefill_and_the_event_trail()
    {
        var (candidate, interview, interviewer, actor) = Booked();

        await Interviews().RescheduleAsync(
            interview.Id, Move(interviewerIds: [interviewer.Id], notes: "Focus on system design"),
            null, actor.Id, actor.Name);

        var (dto, _, notFound, _) = await Interviews().GetScheduleAsync(interview.Id, null);

        Assert.False(notFound);
        Assert.Equal(candidate.Id, dto!.CandidateId);
        Assert.Equal(candidate.FullName, dto.CandidateName);
        Assert.Equal(InterviewStatuses.Scheduled, dto.Status);
        Assert.Equal("Focus on system design", dto.Notes);
        Assert.Equal([interviewer.Id], dto.InterviewerUserIds);
        Assert.False(dto.HasSubmittedEvaluation);
        Assert.Contains(dto.Events, e => e.EventType == InterviewEventTypes.Rescheduled);
    }

    [Fact]
    public async Task The_schedule_read_model_flags_a_submitted_evaluation()
    {
        var (_, interview, interviewer, _) = Booked();
        Data.AddSubmittedEvaluation(interview.Id, interviewer.Id);

        var (dto, _, _, _) = await Interviews().GetScheduleAsync(interview.Id, null);

        Assert.True(dto!.HasSubmittedEvaluation);
    }

    [Fact]
    public async Task Notes_fall_back_to_the_scheduling_entrys_comment_for_older_interviews()
    {
        // Interviews booked before Interview.Notes existed kept the recruiter's note there.
        var (candidate, _, interviewer, _) = Booked();
        var entry = new StatusHistory
        {
            CandidateId = candidate.Id,
            Status = Scheduled,
            Comment = "Ask about the payments project",
            ChangedBy = "test",
        };
        Db.StatusHistories.Add(entry);
        await Db.SaveChangesAsync();

        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        interview.StatusHistoryId = entry.Id;
        await Db.SaveChangesAsync();

        var (dto, _, _, _) = await Interviews().GetScheduleAsync(interview.Id, null);

        Assert.Equal("Ask about the payments project", dto!.Notes);
    }
}
