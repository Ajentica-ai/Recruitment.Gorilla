using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Which evaluation rubric an interview uses (#188). A candidate's job opening is
/// <c>RoleAppliedOptionId</c>; the legacy free-text <c>AppliedRole</c> is null for every candidate the UI
/// creates, so a lookup through it silently gave everyone the default rubric. These tests never set
/// <c>AppliedRole</c> unless they are about the legacy fallback.
/// </summary>
public class RubricResolutionTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<EvaluationRubricDto> NewRubricAsync(string name, string key, bool active = true, bool withCriteria = true)
    {
        var admin = Data.AddUser(Roles.Admin);
        var (rubric, error, _) = await EvaluationRubrics().CreateAsync(new UpsertEvaluationRubricDto(
            name, "custom", false, true,
            [new(null, "Testing", key, $"{key} label", null, 1.0, 1)]), admin.Id);
        Assert.NotNull(rubric);
        Assert.Null(error);
        if (!withCriteria)
        {
            // The service refuses to create an empty rubric, but one can end up empty in the data.
            Db.RubricCriteria.RemoveRange(Db.RubricCriteria.Where(c => c.EvaluationRubricId == rubric!.Id));
            await Db.SaveChangesAsync();
        }
        if (!active)
        {
            var row = await Db.EvaluationRubrics.SingleAsync(r => r.Id == rubric!.Id);
            row.IsActive = false;
            await Db.SaveChangesAsync();
        }
        return rubric!;
    }

    /// <summary>An opening on <paramref name="rubricId"/>, a candidate linked to it (AppliedRole stays null), and an interview.</summary>
    private (RoleAppliedOption Role, Candidate Candidate, Interview Interview, User Interviewer) Setup(int rubricId)
    {
        var role = Data.AddRole($"QA-{Guid.NewGuid():N}");
        role.EvaluationRubricId = rubricId;
        Db.SaveChanges();
        var candidate = Data.AddCandidate(roleId: role.Id);
        Assert.Null(candidate.AppliedRole);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);
        return (role, candidate, interview, interviewer);
    }

    private Task<(InterviewEvaluationDto? Dto, string? Error, bool NotFound, bool Conflict)> Submit(
        Interview interview, User interviewer, params string[] keys) =>
        Interviews().UpsertEvaluationAsync(interview.Id, interviewer.Id,
            new UpsertEvaluationDto("ok", "Recommended", null, 4, keys.Select(k => new EvaluationItemDto(k, 4, null)).ToList(), true));

    // ---- the bug ----

    [Fact]
    public async Task A_candidate_linked_only_by_job_opening_gets_that_openings_rubric()
    {
        var custom = await NewRubricAsync("Opening rubric", "OpeningOnlyKey");
        var s = Setup(custom.Id);

        var resolved = await EvaluationRubrics().GetForInterviewAsync(s.Interview.Id);

        Assert.Equal(custom.Id, resolved!.Id);
    }

    [Fact]
    public async Task Submitting_uses_the_openings_rubric_keys_and_refuses_the_default_ones()
    {
        var custom = await NewRubricAsync("Opening rubric", "OpeningOnlyKey");
        var s = Setup(custom.Id);

        var (refused, error, _, _) = await Submit(s.Interview, s.Interviewer, "RelevanceOfExperience");
        Assert.Null(refused);
        Assert.Contains("Unknown criterion", error);

        var (accepted, error2, _, _) = await Submit(s.Interview, s.Interviewer, "OpeningOnlyKey");
        Assert.Null(error2);
        Assert.True(accepted!.IsSubmitted);
    }

    [Fact]
    public async Task Renaming_the_opening_does_not_break_it()
    {
        var custom = await NewRubricAsync("Opening rubric", "OpeningOnlyKey");
        var s = Setup(custom.Id);
        s.Role.Name = "Renamed opening";
        await Db.SaveChangesAsync();

        Assert.Equal(custom.Id, (await EvaluationRubrics().GetForInterviewAsync(s.Interview.Id))!.Id);
    }

    // ---- legacy data keeps working ----

    [Fact]
    public async Task A_candidate_with_only_the_legacy_role_text_still_matches_by_name()
    {
        var custom = await NewRubricAsync("Opening rubric", "OpeningOnlyKey");
        var role = Data.AddRole($"Legacy-{Guid.NewGuid():N}");
        role.EvaluationRubricId = custom.Id;
        Db.SaveChanges();
        var candidate = Data.AddCandidate(); // no job opening link
        candidate.AppliedRole = role.Name;
        Db.SaveChanges();
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        Assert.Equal(custom.Id, (await EvaluationRubrics().GetForInterviewAsync(interview.Id))!.Id);
        var (dto, error, _, _) = await Submit(interview, interviewer, "OpeningOnlyKey");
        Assert.Null(error);
        Assert.NotNull(dto);
    }

    [Fact]
    public async Task The_opening_link_wins_over_stale_legacy_text_naming_another_opening()
    {
        var mine = await NewRubricAsync("Mine", "MineKey");
        var other = await NewRubricAsync("Other", "OtherKey");
        var s = Setup(mine.Id);
        var otherRole = Data.AddRole($"Other-{Guid.NewGuid():N}");
        otherRole.EvaluationRubricId = other.Id;
        s.Candidate.AppliedRole = otherRole.Name;
        Db.SaveChanges();

        Assert.Equal(mine.Id, (await EvaluationRubrics().GetForInterviewAsync(s.Interview.Id))!.Id);
    }

    // ---- fallbacks, the same on both paths ----

    [Fact]
    public async Task An_inactive_or_empty_rubric_falls_back_to_the_default_on_both_paths()
    {
        var inactive = await NewRubricAsync("Inactive", "InactiveKey", active: false);
        var empty = await NewRubricAsync("Empty", "EmptyKey", withCriteria: false);

        foreach (var rubricId in new[] { inactive.Id, empty.Id })
        {
            var s = Setup(rubricId);
            var resolved = await EvaluationRubrics().GetForInterviewAsync(s.Interview.Id);
            Assert.True(resolved!.IsDefault);

            // And validation agrees: a default key is accepted, the unusable rubric's key is not.
            var (refused, _, _, _) = await Submit(s.Interview, s.Interviewer, "InactiveKey");
            Assert.Null(refused);
            var (accepted, error, _, _) = await Submit(s.Interview, s.Interviewer, resolved.Criteria.Select(c => c.Key).ToArray());
            Assert.Null(error);
            Assert.NotNull(accepted);
        }
    }

    [Fact]
    public async Task An_opening_with_no_rubric_uses_the_default()
    {
        var role = Data.AddRole($"Plain-{Guid.NewGuid():N}");
        var candidate = Data.AddCandidate(roleId: role.Id);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var interview = Data.AddInterview(candidate.Id, interviewer.Id);

        Assert.True((await EvaluationRubrics().GetForInterviewAsync(interview.Id))!.IsDefault);
    }

    // ---- the role name in interview emails ----

    [Fact]
    public async Task Booking_reschedule_and_cancel_emails_carry_the_openings_name()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole("Senior QA Engineer", null, recruiter.Id);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id, roleId: role.Id, status: "Interview Scheduled");
        Assert.Null(candidate.AppliedRole);
        var interviewer = Data.AddUser(Roles.Interviewer);

        var entry = await Candidates().AddStatusAsync(
            candidate.Id,
            new StatusChangeDto("Interview Scheduled", InterviewAt: DateTime.UtcNow.AddDays(3), InterviewerUserIds: [interviewer.Id]),
            recruiter.Name, recruiter.Id);
        var interviewId = entry!.InterviewId!.Value;
        Assert.Contains("Role: Senior QA Engineer", await LastEmailBodyAsync(interviewer.Email));

        await Interviews().RescheduleAsync(
            interviewId,
            new RescheduleInterviewDto(DateTime.UtcNow.AddDays(4), 60, null, [interviewer.Id], null, null),
            null, recruiter.Id, recruiter.Name);
        Assert.Contains("Role: Senior QA Engineer", await LastEmailBodyAsync(interviewer.Email));

        await Interviews().CancelAsync(interviewId, "No longer needed", null, recruiter.Id, recruiter.Name);
        Assert.Contains("Role: Senior QA Engineer", await LastEmailBodyAsync(interviewer.Email));
    }

    private async Task<string> LastEmailBodyAsync(string toEmail) =>
        (await Db.OutboundEmails.AsNoTracking()
            .Where(e => e.ToEmail == toEmail)
            .OrderByDescending(e => e.Id)
            .FirstAsync()).HtmlBody;
}
