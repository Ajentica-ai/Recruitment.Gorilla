using System.Net;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>Candidate create and update rules from #201: an ended job opening, and a duplicate email on edit.</summary>
public class CandidateCreateUpdateRulesTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static CreateCandidateDto NewCandidate(string email, int? roleId) => new(
        "Pat Candidate", email, null, null, "3 Years", null, null, null, null, null, null,
        false, null, null, null, roleId, null, "stored.pdf", "cv.pdf", "PDF", 1024, "Uploaded", null);

    private static UpdateCandidateDto Edit(Candidate c, string? email = null, int? roleId = null, bool allowDuplicate = false) => new(
        c.FullName, email ?? c.Email, null, null, "3 Years", null, null, null, null, null, null,
        IsReferred: false, null, null, null,
        RoleAppliedOptionId: roleId ?? c.RoleAppliedOptionId, SkillOptionIds: null, AllowDuplicate: allowDuplicate);

    // ---- #201 item 3: an ended job opening ----

    [Fact]
    public async Task Creating_a_candidate_into_an_ended_job_opening_is_refused()
    {
        var ended = Data.AddRole(null, DateTime.UtcNow.AddDays(-1));
        var owner = Data.AddUser(Roles.Admin);

        var (created, _, _, error) = await Candidates().CreateAsync(
            NewCandidate($"{Guid.NewGuid():N}@rules.local", ended.Id), owner.Id, owner.Name);

        Assert.Null(created);
        Assert.Equal("The selected job opening is not open.", error);
        Assert.Empty(Db.Candidates.Where(c => c.RoleAppliedOptionId == ended.Id));
    }

    [Fact]
    public async Task Creating_a_candidate_into_an_open_job_opening_still_works()
    {
        var open = Data.AddRole();
        var owner = Data.AddUser(Roles.Admin);

        var (created, _, _, error) = await Candidates().CreateAsync(
            NewCandidate($"{Guid.NewGuid():N}@rules.local", open.Id), owner.Id, owner.Name);

        Assert.Null(error);
        Assert.NotNull(created);
    }

    [Fact]
    public async Task Moving_a_candidate_into_an_ended_job_opening_is_refused_and_changes_nothing()
    {
        var open = Data.AddRole();
        var ended = Data.AddRole(null, DateTime.UtcNow.AddDays(-1));
        var candidate = Data.AddCandidate(roleId: open.Id);

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate, roleId: ended.Id));

        Assert.Null(updated);
        Assert.Equal("The selected job opening is not open.", error);
        Assert.Equal(open.Id, Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).RoleAppliedOptionId);
    }

    [Fact]
    public async Task A_candidate_already_in_an_ended_opening_can_still_be_edited_when_the_role_is_left_alone()
    {
        // The edit lock for ended openings is the controller's job (GetRoleLockErrorAsync); the service rule is only
        // about moving a candidate INTO one.
        var ended = Data.AddRole(null, DateTime.UtcNow.AddDays(-1));
        var candidate = Data.AddCandidate(roleId: ended.Id);

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate));

        Assert.Null(error);
        Assert.NotNull(updated);
    }

    // ---- #201 item 4: the duplicate-email check on update ----

    [Fact]
    public async Task Changing_the_email_to_one_another_candidate_uses_is_refused_and_changes_nothing()
    {
        var other = Data.AddCandidate();
        var candidate = Data.AddCandidate();
        var original = candidate.Email;

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate, email: other.Email));

        Assert.Null(updated);
        Assert.Equal("Another candidate already uses this email address.", error);
        Assert.Equal(original, Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).Email);
    }

    [Fact]
    public async Task The_refusal_does_not_say_who_the_other_candidate_is()
    {
        var other = Data.AddCandidate();
        var candidate = Data.AddCandidate();

        var (_, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate, email: other.Email));

        Assert.DoesNotContain(other.FullName, error!);
        Assert.DoesNotContain(other.Id.ToString(), error!);
    }

    [Fact]
    public async Task AllowDuplicate_lets_the_email_change_through()
    {
        var other = Data.AddCandidate();
        var candidate = Data.AddCandidate();

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate, email: other.Email, allowDuplicate: true));

        Assert.Null(error);
        Assert.Equal(other.Email, updated!.Email);
    }

    [Fact]
    public async Task Saving_without_changing_the_email_is_never_blocked_even_if_a_duplicate_already_exists()
    {
        var shared = $"{Guid.NewGuid():N}@dup.local";
        var a = Data.AddCandidate(email: shared);
        Data.AddCandidate(email: shared);

        var (updated, error) = await Candidates().UpdateAsync(a.Id, Edit(a));

        Assert.Null(error);
        Assert.NotNull(updated);
    }

    [Fact]
    public async Task Changing_the_email_to_a_fresh_one_works()
    {
        var candidate = Data.AddCandidate();

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, Edit(candidate, email: $"{Guid.NewGuid():N}@fresh.local"));

        Assert.Null(error);
        Assert.NotNull(updated);
    }
}

/// <summary>
/// The rubric-for-interview endpoint is scoped like the rest of /api/interviews/* (#201 item 2): it used to answer any
/// signed-in user for any interview id, which also told them whether the interview exists.
/// </summary>
[Collection(ApiCollection.Name)]
public class RubricForInterviewScopeTests(ApiFixture fx)
{
    private async Task<HttpResponseMessage> GetAsync(string email, int interviewId) =>
        await fx.SendAsync(HttpMethod.Get, $"/api/evaluation-rubrics/for-interview/{interviewId}", await fx.LoginAsync(email));

    [Fact]
    public async Task Admin_can_read_it_for_any_interview()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: false);
        Assert.Equal(HttpStatusCode.OK, (await GetAsync(fx.AdminEmail, interviewId)).StatusCode);
    }

    [Fact]
    public async Task An_assigned_interviewer_can_read_it_to_fill_in_their_evaluation()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: true);
        Assert.Equal(HttpStatusCode.OK, (await GetAsync(fx.InterviewerEmail, interviewId)).StatusCode);
    }

    [Fact]
    public async Task An_interviewer_who_is_not_on_the_interview_gets_a_404_like_a_missing_one()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: false);

        var notAssigned = await GetAsync(fx.InterviewerEmail, interviewId);
        var missing = await GetAsync(fx.InterviewerEmail, 999_999);

        Assert.Equal(HttpStatusCode.NotFound, notAssigned.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task A_recruiter_reads_it_only_for_candidates_they_can_see()
    {
        var mine = await fx.NewCandidateAsync(fx.RecruiterId);
        var notMine = await fx.NewCandidateAsync(fx.AdminId);
        var myInterview = await fx.NewInterviewAsync(mine);
        var otherInterview = await fx.NewInterviewAsync(notMine);

        Assert.Equal(HttpStatusCode.OK, (await GetAsync(fx.RecruiterEmail, myInterview)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await GetAsync(fx.RecruiterEmail, otherInterview)).StatusCode);
    }

    [Fact]
    public async Task A_recruiter_assigned_to_the_candidates_job_opening_can_read_it()
    {
        var roleId = await fx.NewRoleAsync(null, true, fx.RecruiterId);
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, roleId);
        var interviewId = await fx.NewInterviewAsync(candidateId);

        Assert.Equal(HttpStatusCode.OK, (await GetAsync(fx.RecruiterEmail, interviewId)).StatusCode);
    }

    [Fact]
    public async Task An_interviewer_who_happens_to_own_the_candidate_id_gets_nothing_from_the_recruiter_rule()
    {
        // Ownership only counts for a Recruiter; the Interviewer role has no candidate scope.
        var candidateId = await fx.NewCandidateAsync(fx.InterviewerId);
        var interviewId = await fx.NewInterviewAsync(candidateId);

        Assert.Equal(HttpStatusCode.NotFound, (await GetAsync(fx.InterviewerEmail, interviewId)).StatusCode);
    }
}

/// <summary>Pins the behaviour of the two methods #201 item 6 rewrote for fewer round trips.</summary>
public class NotificationAndOfferMetricsTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private void Notify(int userId, bool read, string title = "t") =>
        Db.Notifications.Add(new Notification { UserId = userId, Title = title, Message = "m", IsRead = read });

    [Fact]
    public async Task Mark_all_read_marks_only_the_callers_unread_notifications()
    {
        var me = Data.AddUser(Roles.Recruiter);
        var someoneElse = Data.AddUser(Roles.Recruiter);
        Notify(me.Id, false, "mine 1");
        Notify(me.Id, false, "mine 2");
        Notify(me.Id, true, "already read");
        Notify(someoneElse.Id, false, "theirs");
        await Db.SaveChangesAsync();

        await Notifications().MarkAllReadAsync(me.Id);

        var rows = await Db.Notifications.AsNoTracking().Where(n => n.UserId == me.Id || n.UserId == someoneElse.Id).ToListAsync();
        Assert.All(rows.Where(n => n.UserId == me.Id), n => Assert.True(n.IsRead));
        Assert.False(rows.Single(n => n.UserId == someoneElse.Id).IsRead);
    }

    [Fact]
    public async Task Mark_all_read_with_nothing_unread_is_a_no_op()
    {
        var me = Data.AddUser(Roles.Recruiter);

        await Notifications().MarkAllReadAsync(me.Id);
        await Notifications().MarkAllReadAsync(me.Id);

        Assert.Empty(Db.Notifications.Where(n => n.UserId == me.Id));
    }

    [Fact]
    public async Task Offer_metrics_for_a_recruiter_cover_only_their_candidates()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var mine = Data.AddCandidate(ownerUserId: recruiter.Id, status: "Hired");
        var notMine = Data.AddCandidate(status: "Hired");
        void Add(int candidateId, string status) =>
            Db.Offers.Add(new Offer { CandidateId = candidateId, JobTitle = "E", BaseSalary = 1, Currency = "USD", Status = status, CreatedByUserId = recruiter.Id });
        Add(mine.Id, "Accepted");
        Add(mine.Id, "Declined");
        Add(mine.Id, "Extended");
        Add(notMine.Id, "Accepted");
        Add(notMine.Id, "Accepted");
        await Db.SaveChangesAsync();

        var m = await Offers().GetMetricsAsync(recruiter.Id);

        Assert.Equal(3, m.TotalOffers);
        Assert.Equal(1, m.ActiveOffers);
        Assert.Equal(1, m.AcceptedOffers);
        Assert.Equal(1, m.DeclinedOffers);
        Assert.Equal(1, m.TotalHired);
        Assert.Equal(50.0, m.AcceptanceRatePercentage);
    }
}

/// <summary>The three controller scope checks #201 item 5 made cheap must still refuse out-of-scope callers.</summary>
[Collection(ApiCollection.Name)]
public class CandidateScopeCheckTests(ApiFixture fx)
{
    [Fact]
    public async Task An_out_of_scope_recruiter_gets_a_404_for_a_status_change()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{candidateId}/status", token, new { status = "Call for Interview" });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task An_out_of_scope_recruiter_gets_a_404_for_a_cv_file_and_a_missing_one_gets_the_same()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        var outOfScope = await fx.SendAsync(HttpMethod.Get, $"/api/candidates/{candidateId}/cv/1", token);
        var missing = await fx.SendAsync(HttpMethod.Get, "/api/candidates/999999/cv/1", token);

        Assert.Equal(HttpStatusCode.NotFound, outOfScope.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task An_in_scope_recruiter_passes_the_scope_check_for_a_status_change()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{candidateId}/status", token, new { status = "Call for Interview" });

        // Past the scope check: whatever the transition rules say, it is not a 404.
        Assert.NotEqual(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Deleting_a_candidate_still_records_their_name_in_the_audit_line()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Delete, $"/api/candidates/{candidateId}", token);

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
        Assert.True(await fx.AuditSummaryContainsAsync("Candidate.Deleted", candidateId, "Cand-"));
    }
}

/// <summary>An edit by a caller who cannot see the candidate is a 404 whatever the opening's state (#201 review).</summary>
[Collection(ApiCollection.Name)]
public class CandidateUpdateScopeAndConflictTests(ApiFixture fx)
{
    private static object Body(string email) => new
    {
        fullName = "Edit Me", email, relevantExperience = "3 Years", isReferred = false,
    };

    [Fact]
    public async Task An_out_of_scope_recruiter_gets_404_not_400_even_when_the_candidates_opening_has_ended()
    {
        var ended = await fx.NewRoleAsync(DateTime.UtcNow.AddDays(-1));
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, ended);
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        var resp = await fx.SendAsync(HttpMethod.Put, $"/api/candidates/{candidateId}", token, Body("anyone@example.com"));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Changing_the_email_to_one_in_use_is_a_409_over_http_and_leaves_the_candidate_alone()
    {
        var takenEmail = $"{Guid.NewGuid():N}@taken.local";
        await fx.NewCandidateAsync(fx.AdminId, email: takenEmail);
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Put, $"/api/candidates/{candidateId}", token, Body(takenEmail));

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Equal("Another candidate already uses this email address.", await resp.Content.ReadAsStringAsync());
    }
}
