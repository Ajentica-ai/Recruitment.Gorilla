using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EvaluationShareService (#183): who may be granted read access to a candidate's submitted
/// evaluations, how grants are stored, and the validation around them. Nothing reads a grant yet.
/// </summary>
public class EvaluationShareServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private (User Grantor, Candidate Candidate) Setup()
    {
        var grantor = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: grantor.Id);
        return (grantor, candidate);
    }

    private Task<(CreateEvaluationSharesResultDto? Result, string? Error)> Create(
        Candidate candidate, User grantor, List<int> grantees, List<int>? interviews = null,
        DateTime? expiresAt = null, string? note = null) =>
        EvaluationShares().CreateAsync(
            candidate.Id, new CreateEvaluationSharesDto(grantees, interviews, expiresAt, note), grantor.Id, grantor.Name);

    private int GrantCount(int candidateId) => Db.EvaluationAccessGrants.Count(g => g.CandidateId == candidateId);

    [Fact]
    public async Task Too_many_interview_ids_is_rejected_before_any_write()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);

        var (result, error) = await Create(candidate, grantor, [grantee.Id],
            interviews: Enumerable.Range(1, EvaluationShareService.MaxInterviewsPerRequest + 1).ToList());

        Assert.Null(result);
        Assert.NotNull(error);
        Assert.Equal(0, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task Regrant_that_changes_expiry_is_audited_as_updated()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        await Create(candidate, grantor, [grantee.Id], expiresAt: DateTime.UtcNow.AddDays(2));

        await Create(candidate, grantor, [grantee.Id], expiresAt: DateTime.UtcNow.AddDays(9));

        Assert.Equal(1, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Updated" && a.EntityId == candidate.Id));
    }

    [Fact]
    public async Task Regrant_without_an_expiry_or_note_keeps_the_existing_ones()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        var expiry = DateTime.UtcNow.AddDays(2);
        await Create(candidate, grantor, [grantee.Id], expiresAt: expiry, note: "keep me");

        await Create(candidate, grantor, [grantee.Id]);

        var grant = Assert.Single(Db.EvaluationAccessGrants.AsNoTracking().Where(g => g.CandidateId == candidate.Id));
        Assert.Equal("keep me", grant.Note);
        Assert.Equal(expiry, grant.ExpiresAt!.Value, TimeSpan.FromSeconds(1));
        Assert.Equal(0, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Updated" && a.EntityId == candidate.Id));
    }

    // ---- create: what gets stored ----

    [Fact]
    public async Task Candidate_wide_share_stores_one_manual_grant_with_no_interview()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);

        var (result, error) = await Create(candidate, grantor, [grantee.Id], note: "Round 2 prep");

        Assert.Null(error);
        Assert.Single(result!.Shares);
        Assert.Empty(result.Skipped);
        var grant = Assert.Single(Db.EvaluationAccessGrants.Where(g => g.CandidateId == candidate.Id));
        Assert.Null(grant.InterviewId);
        Assert.Equal(grantee.Id, grant.GranteeUserId);
        Assert.Equal(grantor.Id, grant.GrantedByUserId);
        Assert.Equal("Manual", grant.Source);
        Assert.Equal("Round 2 prep", grant.Note);
        Assert.Null(grant.RevokedAt);
        Assert.True(result.Shares[0].IsActive);
    }

    [Fact]
    public async Task Per_interview_share_stores_one_grant_per_interview()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        var round1 = Data.AddInterview(candidate.Id);
        var round2 = Data.AddInterview(candidate.Id);

        var (result, error) = await Create(candidate, grantor, [grantee.Id], [round1.Id, round2.Id]);

        Assert.Null(error);
        Assert.Equal(2, result!.Shares.Count);
        Assert.Equal(
            new[] { round1.Id, round2.Id }.Order(),
            Db.EvaluationAccessGrants.Where(g => g.CandidateId == candidate.Id).Select(g => g.InterviewId!.Value).ToList().Order());
    }

    [Fact]
    public async Task Sharing_with_several_people_stores_a_grant_for_each()
    {
        var (grantor, candidate) = Setup();
        var a = Data.AddUser(Roles.Interviewer);
        var b = Data.AddUser(Roles.Interviewer);

        var (result, _) = await Create(candidate, grantor, [a.Id, b.Id]);

        Assert.Equal(2, result!.Shares.Count);
        Assert.Equal(2, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task Granting_notifies_the_grantee_once_with_no_link_and_is_audited()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        var round1 = Data.AddInterview(candidate.Id);
        var round2 = Data.AddInterview(candidate.Id);

        await Create(candidate, grantor, [grantee.Id], [round1.Id, round2.Id]);

        // One notification per person, not per interview, linking to the grantee's shared report.
        var notification = Assert.Single(Db.Notifications.Where(n => n.UserId == grantee.Id));
        Assert.Equal($"/shared/candidates/{candidate.Id}/evaluations", notification.LinkUrl);
        Assert.Equal(2, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Granted" && a.EntityId == candidate.Id));
    }

    // ---- create: re-granting, skipping people who already have access ----

    [Fact]
    public async Task Regranting_an_identical_active_share_updates_note_and_expiry_instead_of_duplicating()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        await Create(candidate, grantor, [grantee.Id], note: "first");
        var notificationsBefore = Db.Notifications.Count(n => n.UserId == grantee.Id);

        var later = DateTime.UtcNow.AddDays(10);
        var (result, error) = await Create(candidate, grantor, [grantee.Id], expiresAt: later, note: "second");

        Assert.Null(error);
        Assert.Single(result!.Shares);
        var grant = Assert.Single(Db.EvaluationAccessGrants.AsNoTracking().Where(g => g.CandidateId == candidate.Id));
        Assert.Equal("second", grant.Note);
        Assert.Equal(later, grant.ExpiresAt!.Value, TimeSpan.FromSeconds(1));
        // An update is not news to the grantee.
        Assert.Equal(notificationsBefore, Db.Notifications.Count(n => n.UserId == grantee.Id));
    }

    [Fact]
    public async Task An_expired_grant_does_not_count_as_active_so_a_new_one_is_inserted()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        Db.EvaluationAccessGrants.Add(new EvaluationAccessGrant
        {
            CandidateId = candidate.Id, GranteeUserId = grantee.Id, GrantedByUserId = grantor.Id,
            Source = "Manual", ExpiresAt = DateTime.UtcNow.AddDays(-1),
        });
        Db.SaveChanges();

        await Create(candidate, grantor, [grantee.Id]);

        Assert.Equal(2, GrantCount(candidate.Id));
        var listed = await EvaluationShares().ListAsync(candidate.Id);
        Assert.Equal(1, listed.Count(s => s.IsActive));
    }

    [Fact]
    public async Task Admins_and_the_candidates_own_recruiters_are_skipped_with_a_reason_not_stored()
    {
        var owner = Data.AddUser(Roles.Recruiter);
        var assigned = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(null, null, assigned.Id);
        var candidate = Data.AddCandidate(ownerUserId: owner.Id, roleId: role.Id);
        var admin = Data.AddUser(Roles.Admin);
        var superAdmin = Data.AddUser(Roles.SuperAdmin);
        var outsideRecruiter = Data.AddUser(Roles.Recruiter);
        var interviewer = Data.AddUser(Roles.Interviewer);

        var (result, error) = await Create(candidate, owner,
            [admin.Id, superAdmin.Id, owner.Id, assigned.Id, outsideRecruiter.Id, interviewer.Id]);

        Assert.Null(error);
        // Only the Recruiter with no scope over this candidate, and the Interviewer, gain anything.
        Assert.Equal(
            new[] { outsideRecruiter.Id, interviewer.Id }.Order(),
            result!.Shares.Select(s => s.GranteeUserId).Order());
        Assert.Equal(
            new[] { admin.Id, superAdmin.Id, owner.Id, assigned.Id }.Order(),
            result.Skipped.Select(s => s.UserId).Order());
        Assert.All(result.Skipped, s => Assert.False(string.IsNullOrWhiteSpace(s.Reason)));
        Assert.Equal(2, GrantCount(candidate.Id));
    }

    // ---- create: validation writes nothing ----

    [Fact]
    public async Task Nobody_chosen_is_rejected()
    {
        var (grantor, candidate) = Setup();

        var (result, error) = await Create(candidate, grantor, []);

        Assert.Null(result);
        Assert.False(string.IsNullOrWhiteSpace(error));
        Assert.Equal(0, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task More_than_twenty_people_in_one_request_is_rejected()
    {
        var (grantor, candidate) = Setup();
        var many = Enumerable.Range(0, 21).Select(_ => Data.AddUser(Roles.Interviewer).Id).ToList();

        var (result, error) = await Create(candidate, grantor, many);

        Assert.Null(result);
        Assert.Contains("20", error);
        Assert.Equal(0, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task Inactive_and_unknown_users_are_rejected_and_nothing_is_stored()
    {
        var (grantor, candidate) = Setup();
        var active = Data.AddUser(Roles.Interviewer);
        var inactive = Data.AddUser(Roles.Interviewer, active: false);

        var (r1, e1) = await Create(candidate, grantor, [active.Id, inactive.Id]);
        var (r2, e2) = await Create(candidate, grantor, [active.Id, 99_999_999]);

        Assert.Null(r1);
        Assert.False(string.IsNullOrWhiteSpace(e1));
        Assert.Null(r2);
        Assert.False(string.IsNullOrWhiteSpace(e2));
        // All or nothing: the valid person in the same request is not shared with either.
        Assert.Equal(0, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task Interviews_of_another_candidate_or_cancelled_ones_are_rejected()
    {
        var (grantor, candidate) = Setup();
        var other = Data.AddCandidate(ownerUserId: grantor.Id);
        var grantee = Data.AddUser(Roles.Interviewer);
        var foreign = Data.AddInterview(other.Id);
        var cancelled = Data.AddInterview(candidate.Id);
        cancelled.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        var (r1, e1) = await Create(candidate, grantor, [grantee.Id], [foreign.Id]);
        var (r2, e2) = await Create(candidate, grantor, [grantee.Id], [cancelled.Id]);
        var (r3, e3) = await Create(candidate, grantor, [grantee.Id], [99_999_999]);

        Assert.Null(r1);
        Assert.False(string.IsNullOrWhiteSpace(e1));
        Assert.Null(r2);
        Assert.False(string.IsNullOrWhiteSpace(e2));
        Assert.Null(r3);
        Assert.False(string.IsNullOrWhiteSpace(e3));
        Assert.Equal(0, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task An_expiry_in_the_past_or_a_note_over_500_characters_is_rejected()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);

        var (r1, e1) = await Create(candidate, grantor, [grantee.Id], expiresAt: DateTime.UtcNow.AddMinutes(-1));
        var (r2, e2) = await Create(candidate, grantor, [grantee.Id], note: new string('x', 501));
        var (r3, _) = await Create(candidate, grantor, [grantee.Id], note: new string('x', 500));

        Assert.Null(r1);
        Assert.False(string.IsNullOrWhiteSpace(e1));
        Assert.Null(r2);
        Assert.False(string.IsNullOrWhiteSpace(e2));
        Assert.NotNull(r3); // exactly 500 is allowed
        Assert.Equal(1, GrantCount(candidate.Id));
    }

    [Fact]
    public async Task A_missing_candidate_is_reported_as_an_error_not_a_crash()
    {
        var grantor = Data.AddUser(Roles.Admin);
        var grantee = Data.AddUser(Roles.Interviewer);

        var (result, error) = await EvaluationShares().CreateAsync(
            99_999_999, new CreateEvaluationSharesDto([grantee.Id]), grantor.Id, grantor.Name);

        Assert.Null(result);
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    // ---- list and revoke ----

    [Fact]
    public async Task List_returns_active_and_revoked_grants_with_names()
    {
        var (grantor, candidate) = Setup();
        var a = Data.AddUser(Roles.Interviewer, name: "Alice Panel");
        var b = Data.AddUser(Roles.Interviewer, name: "Bob Panel");
        var (created, _) = await Create(candidate, grantor, [a.Id, b.Id]);
        await EvaluationShares().RevokeAsync(candidate.Id, created!.Shares[0].Id, grantor.Id, grantor.Name);

        var listed = await EvaluationShares().ListAsync(candidate.Id);

        Assert.Equal(2, listed.Count);
        Assert.Equal(1, listed.Count(s => s.IsActive));
        var revoked = Assert.Single(listed, s => !s.IsActive);
        Assert.NotNull(revoked.RevokedAt);
        Assert.Equal(grantor.Name, revoked.RevokedByName);
        Assert.All(listed, s => Assert.Equal(grantor.Name, s.GrantedByName));
        Assert.Contains(listed, s => s.GranteeName == "Alice Panel");
    }

    [Fact]
    public async Task Revoke_is_soft_the_row_stays_for_audit_and_is_audited()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        var (created, _) = await Create(candidate, grantor, [grantee.Id]);
        var shareId = created!.Shares[0].Id;

        var outcome = await EvaluationShares().RevokeAsync(candidate.Id, shareId, grantor.Id, grantor.Name);

        Assert.Equal(RevokeShareResult.Revoked, outcome);
        var grant = Db.EvaluationAccessGrants.AsNoTracking().Single(g => g.Id == shareId);
        Assert.NotNull(grant.RevokedAt);
        Assert.Equal(grantor.Id, grant.RevokedByUserId);
        Assert.Equal(1, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Revoked" && a.EntityId == candidate.Id));
    }

    [Fact]
    public async Task Revoking_twice_keeps_the_first_revocation()
    {
        var (grantor, candidate) = Setup();
        var grantee = Data.AddUser(Roles.Interviewer);
        var (created, _) = await Create(candidate, grantor, [grantee.Id]);
        var shareId = created!.Shares[0].Id;
        await EvaluationShares().RevokeAsync(candidate.Id, shareId, grantor.Id, grantor.Name);
        var first = Db.EvaluationAccessGrants.AsNoTracking().Single(g => g.Id == shareId).RevokedAt;

        var second = await EvaluationShares().RevokeAsync(candidate.Id, shareId, grantor.Id, grantor.Name);

        Assert.Equal(RevokeShareResult.Revoked, second);
        Assert.Equal(first, Db.EvaluationAccessGrants.AsNoTracking().Single(g => g.Id == shareId).RevokedAt);
        Assert.Equal(1, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Revoked" && a.EntityId == candidate.Id));
    }

    [Fact]
    public async Task Revoking_a_share_that_belongs_to_another_candidate_is_not_found_and_writes_nothing()
    {
        var (grantor, candidate) = Setup();
        var other = Data.AddCandidate(ownerUserId: grantor.Id);
        var grantee = Data.AddUser(Roles.Interviewer);
        var (created, _) = await Create(other, grantor, [grantee.Id]);
        var shareId = created!.Shares[0].Id;

        var outcome = await EvaluationShares().RevokeAsync(candidate.Id, shareId, grantor.Id, grantor.Name);
        var missing = await EvaluationShares().RevokeAsync(candidate.Id, 99_999_999, grantor.Id, grantor.Name);

        Assert.Equal(RevokeShareResult.NotFound, outcome);
        Assert.Equal(RevokeShareResult.NotFound, missing);
        Assert.Null(Db.EvaluationAccessGrants.AsNoTracking().Single(g => g.Id == shareId).RevokedAt);
        Assert.Equal(0, Db.AuditLogs.Count(a => a.Action == "EvaluationShare.Revoked"));
    }

    // ---- options for the share drawer (#185) ----

    [Fact]
    public async Task Options_list_non_cancelled_interviews_with_their_panel()
    {
        var (grantor, candidate) = Setup();
        var panelist = Data.AddUser(Roles.Interviewer, name: "Pat Panel");
        var live = Data.AddInterview(candidate.Id, panelist.Id);
        var cancelled = Data.AddInterview(candidate.Id, panelist.Id);
        cancelled.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        var options = await EvaluationShares().GetOptionsAsync(candidate.Id);

        var only = Assert.Single(options!.Interviews);
        Assert.Equal(live.Id, only.InterviewId);
        Assert.Equal(["Pat Panel"], only.Panel);
        Assert.DoesNotContain(options.Interviews, i => i.InterviewId == cancelled.Id);
    }

    [Fact]
    public async Task Options_flag_people_who_already_read_everything_and_leave_others_selectable()
    {
        var (_, candidate) = Setup(); // owned by a Recruiter
        var owner = Db.Users.Single(u => u.Id == candidate.OwnerUserId);
        var admin = Data.AddUser(Roles.Admin);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var otherRecruiter = Data.AddUser(Roles.Recruiter); // no scope over this candidate
        var inactive = Data.AddUser(Roles.Interviewer, active: false);

        var options = await EvaluationShares().GetOptionsAsync(candidate.Id);

        UserOptionState(options!, owner.Id, expectAlready: true);
        UserOptionState(options!, admin.Id, expectAlready: true);
        UserOptionState(options!, interviewer.Id, expectAlready: false);
        UserOptionState(options!, otherRecruiter.Id, expectAlready: false);
        Assert.DoesNotContain(options!.Users, u => u.UserId == inactive.Id);
    }

    private static void UserOptionState(ShareOptionsDto options, int userId, bool expectAlready)
    {
        var user = Assert.Single(options.Users, u => u.UserId == userId);
        Assert.Equal(expectAlready, user.AlreadyHasAccess);
        Assert.Equal(expectAlready, user.Reason is not null);
    }

    [Fact]
    public async Task Options_for_a_missing_candidate_is_null()
    {
        Assert.Null(await EvaluationShares().GetOptionsAsync(int.MaxValue));
    }

    [Fact]
    public async Task Options_count_the_earlier_rounds_that_have_a_submitted_evaluation()
    {
        var (_, candidate) = Setup();
        var panelist = Data.AddUser(Roles.Interviewer);
        var evaluated = Data.AddInterview(candidate.Id, panelist.Id);
        Data.AddSubmittedEvaluation(evaluated.Id, panelist.Id);
        var draftOnly = Data.AddInterview(candidate.Id, panelist.Id);
        Db.InterviewEvaluations.Add(new InterviewEvaluation { InterviewId = draftOnly.Id, InterviewerUserId = panelist.Id, IsSubmitted = false });
        var cancelledEvaluated = Data.AddInterview(candidate.Id, panelist.Id);
        Data.AddSubmittedEvaluation(cancelledEvaluated.Id, panelist.Id);
        cancelledEvaluated.Status = InterviewStatuses.Cancelled;
        Db.SaveChanges();

        var options = await EvaluationShares().GetOptionsAsync(candidate.Id);

        Assert.Equal(1, options!.EarlierRoundsWithEvaluations);
    }
}
