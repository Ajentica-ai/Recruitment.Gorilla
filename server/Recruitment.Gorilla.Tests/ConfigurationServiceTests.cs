using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>ConfigurationService — recruiter assignment (many-to-many), scoped role lookup, and delete rules.</summary>
public class ConfigurationServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static UpsertRoleAppliedOptionDto RoleDto(string name, params int[] recruiterUserIds) =>
        new(name, 100, true, DateTime.UtcNow.AddDays(30), RecruiterUserIds: recruiterUserIds.ToList());

    [Fact]
    public async Task CreateRole_persists_recruiter_assignments()
    {
        var r1 = Data.AddUser(Roles.Recruiter);
        var r2 = Data.AddUser(Roles.Recruiter);

        var (created, conflict, error) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", r1.Id, r2.Id));

        Assert.Null(error);
        Assert.False(conflict);
        Assert.NotNull(created);
        Assert.Equal(new[] { r1.Id, r2.Id }.OrderBy(x => x), created!.Recruiters.Select(x => x.UserId).OrderBy(x => x));
    }

    [Fact]
    public async Task CreateRole_rejects_an_inactive_or_unknown_recruiter()
    {
        var inactive = Data.AddUser(Roles.Recruiter, active: false);

        var (_, _, unknownErr) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", 999999));
        Assert.Contains("not valid active users", unknownErr);

        var (_, _, inactiveErr) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", inactive.Id));
        Assert.Contains("not valid active users", inactiveErr);
    }

    [Fact]
    public async Task CreateRole_rejects_a_recruiter_that_cannot_write_candidates()
    {
        // An Interviewer saves fine but gains nothing (CandidatesController excludes the role),
        // so the assignment must be rejected rather than silently do nothing.
        var interviewer = Data.AddUser(Roles.Interviewer, name: "Ivy Interviewer");

        var (created, _, error) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", interviewer.Id));

        Assert.Null(created);
        Assert.Contains("Recruiter role or higher", error);
        Assert.Contains("Ivy Interviewer", error);
    }

    [Theory]
    [InlineData(Roles.SuperAdmin)]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Recruiter)]
    public async Task CreateRole_accepts_every_role_that_can_write_candidates(string role)
    {
        var user = Data.AddUser(role);

        var (created, _, error) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", user.Id));

        Assert.Null(error);
        Assert.Equal([user.Id], created!.Recruiters.Select(x => x.UserId));
    }

    [Fact]
    public async Task GetRecruiterOptions_lists_only_active_candidate_writers()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var admin = Data.AddUser(Roles.Admin);
        var interviewer = Data.AddUser(Roles.Interviewer);
        var inactive = Data.AddUser(Roles.Recruiter, active: false);

        var ids = (await Config().GetRecruiterOptionsAsync()).Select(u => u.Id).ToHashSet();

        Assert.Contains(recruiter.Id, ids);
        Assert.Contains(admin.Id, ids);
        Assert.DoesNotContain(interviewer.Id, ids);
        Assert.DoesNotContain(inactive.Id, ids);
    }

    [Fact]
    public async Task UpdateRole_replaces_the_recruiter_set()
    {
        var r1 = Data.AddUser(Roles.Recruiter);
        var r2 = Data.AddUser(Roles.Recruiter);
        var (created, _, _) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", r1.Id));

        var (updated, notFound, conflict, error) = await Config().UpdateRoleAsync(
            created!.Id, RoleDto(created.Name, r2.Id));

        Assert.Null(error);
        Assert.False(notFound);
        Assert.False(conflict);
        Assert.Equal([r2.Id], updated!.Recruiters.Select(x => x.UserId));
    }

    [Fact]
    public async Task CreateRole_notifies_newly_assigned_recruiters_but_not_the_actor()
    {
        var actor = Data.AddUser(Roles.Admin);
        var r1 = Data.AddUser(Roles.Recruiter);

        var (created, _, error) = await Config().CreateRoleAsync(
            RoleDto($"R-{Guid.NewGuid():N}", actor.Id, r1.Id), actorUserId: actor.Id);

        Assert.Null(error);
        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == actor.Id)); // the actor isn't notified of their own change
        var notification = await Db.Notifications.SingleAsync(n => n.UserId == r1.Id);
        Assert.Equal("Assigned to job opening", notification.Title);
        Assert.Contains(created!.Name, notification.Message);
        Assert.Equal("/jobs", notification.LinkUrl);
    }

    [Fact]
    public async Task UpdateRole_notifies_only_the_newly_added_recruiters()
    {
        var r1 = Data.AddUser(Roles.Recruiter);
        var r2 = Data.AddUser(Roles.Recruiter);
        var (created, _, _) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}", r1.Id));

        // Clear the create-time notification so only the update's notifications are asserted below.
        Db.Notifications.RemoveRange(Db.Notifications.Where(n => n.UserId == r1.Id));
        await Db.SaveChangesAsync();

        await Config().UpdateRoleAsync(created!.Id, RoleDto(created.Name, r1.Id, r2.Id));

        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == r1.Id)); // already assigned — not re-notified
        Assert.True(await Db.Notifications.AnyAsync(n => n.UserId == r2.Id)); // newly added — notified
    }

    [Fact]
    public async Task UpdateRole_does_not_notify_recruiters_when_the_opening_is_inactive()
    {
        var r1 = Data.AddUser(Roles.Recruiter);
        var (created, _, _) = await Config().CreateRoleAsync(RoleDto($"R-{Guid.NewGuid():N}"));

        await Config().UpdateRoleAsync(created!.Id, RoleDto(created.Name, r1.Id) with { IsActive = false });

        Assert.False(await Db.Notifications.AnyAsync(n => n.UserId == r1.Id));
    }

    [Fact]
    public async Task GetAssignedRoles_returns_only_the_users_roles()
    {
        var r1 = Data.AddUser(Roles.Recruiter);
        var r2 = Data.AddUser(Roles.Recruiter);
        var roleA = Data.AddRole(recruiterUserIds: r1.Id);
        var roleB = Data.AddRole(recruiterUserIds: r2.Id);

        var assigned = await Config().GetAssignedRolesAsync(r1.Id);
        var ids = assigned.Select(r => r.Id).ToHashSet();

        Assert.Contains(roleA.Id, ids);
        Assert.DoesNotContain(roleB.Id, ids);
    }

    [Fact]
    public async Task DeleteRole_softdisables_when_it_has_candidates_else_hard_deletes()
    {
        // In use → soft-disable.
        var usedRole = Data.AddRole();
        Data.AddCandidate(roleId: usedRole.Id);
        var (found, deleted, deactivated, count) = await Config().DeleteRoleAsync(usedRole.Id);
        Assert.True(found);
        Assert.False(deleted);
        Assert.True(deactivated);
        Assert.Equal(1, count);
        Assert.False((await Db.RoleAppliedOptions.FindAsync(usedRole.Id))!.IsActive);

        // Not in use → hard delete.
        var freeRole = Data.AddRole();
        var free = await Config().DeleteRoleAsync(freeRole.Id);
        Assert.True(free.Deleted);
        Assert.Null(await Db.RoleAppliedOptions.FindAsync(freeRole.Id));
    }

    [Fact]
    public async Task DeleteSkill_hard_deletes_when_unused_and_softdisables_when_referenced()
    {
        var (unused, _) = await Config().CreateSkillAsync(new UpsertSkillOptionDto($"S-{Guid.NewGuid():N}", 1, true));
        Assert.True(await Config().DeleteSkillAsync(unused!.Id));
        Assert.Null(await Db.SkillOptions.FindAsync(unused.Id));

        var (used, _) = await Config().CreateSkillAsync(new UpsertSkillOptionDto($"S-{Guid.NewGuid():N}", 2, true));
        var candidate = Data.AddCandidate();
        Db.CandidateSkills.Add(new CandidateSkill { CandidateId = candidate.Id, SkillOptionId = used!.Id });
        await Db.SaveChangesAsync();

        Assert.True(await Config().DeleteSkillAsync(used.Id));
        var still = await Db.SkillOptions.FindAsync(used.Id);
        Assert.NotNull(still);
        Assert.False(still!.IsActive);
    }

    [Fact]
    public async Task CreateSource_conflicts_on_a_duplicate_name()
    {
        var name = $"Src-{Guid.NewGuid():N}";
        var (created, conflict) = await Config().CreateSourceAsync(new UpsertCandidateSourceOptionDto(name, 1, true));
        Assert.NotNull(created);
        Assert.False(conflict);

        var (dupe, dupeConflict) = await Config().CreateSourceAsync(new UpsertCandidateSourceOptionDto(name, 2, true));
        Assert.Null(dupe);
        Assert.True(dupeConflict);
    }

    [Fact]
    public async Task GetActiveSources_excludes_inactive_options()
    {
        var (created, _) = await Config().CreateSourceAsync(
            new UpsertCandidateSourceOptionDto($"Src-{Guid.NewGuid():N}", 50, false));

        var active = await Config().GetActiveSourcesAsync();
        var all = await Config().GetAllSourcesAsync();

        Assert.DoesNotContain(created!.Id, active.Select(s => s.Id));
        Assert.Contains(created.Id, all.Select(s => s.Id));
    }

    [Fact]
    public async Task DeleteSource_softdisables_when_a_candidate_uses_it_else_hard_deletes()
    {
        // In use → deactivate, and report the count so the UI can explain why.
        var (used, _) = await Config().CreateSourceAsync(
            new UpsertCandidateSourceOptionDto($"Src-{Guid.NewGuid():N}", 51, true));
        var candidate = Data.AddCandidate();
        candidate.SourceOptionId = used!.Id;
        await Db.SaveChangesAsync();

        var inUse = await Config().DeleteSourceAsync(used.Id);
        Assert.True(inUse.Found);
        Assert.False(inUse.Deleted);
        Assert.True(inUse.Deactivated);
        Assert.Equal(1, inUse.CandidateCount);
        Assert.False((await Db.CandidateSourceOptions.FindAsync(used.Id))!.IsActive);

        // Unused → hard delete.
        var (free, _) = await Config().CreateSourceAsync(
            new UpsertCandidateSourceOptionDto($"Src-{Guid.NewGuid():N}", 52, true));
        var unused = await Config().DeleteSourceAsync(free!.Id);
        Assert.True(unused.Deleted);
        Assert.Null(await Db.CandidateSourceOptions.FindAsync(free.Id));
    }

    [Fact]
    public async Task DeleteSource_reports_not_found_for_an_unknown_id()
    {
        var result = await Config().DeleteSourceAsync(999999);
        Assert.False(result.Found);
    }

    [Fact]
    public async Task DeleteInterviewType_hard_deletes_when_unused()
    {
        var (type, _) = await Config().CreateInterviewTypeAsync(new UpsertInterviewTypeOptionDto($"T-{Guid.NewGuid():N}", 1, true));
        Assert.True(await Config().DeleteInterviewTypeAsync(type!.Id));
        Assert.Null(await Db.InterviewTypeOptions.FindAsync(type.Id));
    }
}
