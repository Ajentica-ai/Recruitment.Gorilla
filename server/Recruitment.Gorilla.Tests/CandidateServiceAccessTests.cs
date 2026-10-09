using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>Candidate access scoping: owned OR assigned-role recruiter; Admin sees all; strict-owner delete.</summary>
public class CandidateServiceAccessTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<HashSet<int>> AccessibleIds(int? accessUserId)
    {
        var page = await Candidates().GetAllAsync(new CandidateListQuery(PageSize: 500), accessUserId);
        return page.Items.Select(i => i.Id).ToHashSet();
    }

    [Fact]
    public async Task Admin_scope_sees_all_candidates()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var owned = Data.AddCandidate(ownerUserId: recruiter.Id);
        var foreign = Data.AddCandidate(ownerUserId: admin.Id);

        var ids = await AccessibleIds(null); // null = Admin+

        Assert.Contains(owned.Id, ids);
        Assert.Contains(foreign.Id, ids);
    }

    [Fact]
    public async Task Recruiter_sees_owned_and_assigned_role_but_not_others()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var otherRole = Data.AddRole();

        var owned = Data.AddCandidate(ownerUserId: recruiter.Id);
        var underAssignedRole = Data.AddCandidate(ownerUserId: admin.Id, roleId: assignedRole.Id); // admin-created
        var underOtherRole = Data.AddCandidate(ownerUserId: admin.Id, roleId: otherRole.Id);
        var foreignNoRole = Data.AddCandidate(ownerUserId: admin.Id);

        var ids = await AccessibleIds(recruiter.Id);

        Assert.Contains(owned.Id, ids);
        Assert.Contains(underAssignedRole.Id, ids); // creator-agnostic: visible via role assignment
        Assert.DoesNotContain(underOtherRole.Id, ids);
        Assert.DoesNotContain(foreignNoRole.Id, ids);
    }

    [Fact]
    public async Task Recruiter_GetById_honors_the_same_access_predicate()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var otherRole = Data.AddRole();

        var visible = Data.AddCandidate(ownerUserId: admin.Id, roleId: assignedRole.Id);
        var hidden = Data.AddCandidate(ownerUserId: admin.Id, roleId: otherRole.Id);

        Assert.NotNull(await Candidates().GetByIdAsync(visible.Id, recruiter.Id));
        Assert.Null(await Candidates().GetByIdAsync(hidden.Id, recruiter.Id));
    }

    [Fact]
    public async Task Multiple_recruiters_on_one_role_each_have_access()
    {
        var admin = Data.AddUser(Roles.Admin);
        var r1 = Data.AddUser(Roles.Recruiter);
        var r2 = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(recruiterUserIds: [r1.Id, r2.Id]);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, roleId: role.Id);

        Assert.NotNull(await Candidates().GetByIdAsync(candidate.Id, r1.Id));
        Assert.NotNull(await Candidates().GetByIdAsync(candidate.Id, r2.Id));
    }

    [Fact]
    public async Task Role_filter_returns_only_that_roles_candidates_within_access_scope()
    {
        var admin = Data.AddUser(Roles.Admin);
        var roleA = Data.AddRole();
        var roleB = Data.AddRole();
        var inA = Data.AddCandidate(ownerUserId: admin.Id, roleId: roleA.Id);
        var alsoInA = Data.AddCandidate(ownerUserId: admin.Id, roleId: roleA.Id);
        var inB = Data.AddCandidate(ownerUserId: admin.Id, roleId: roleB.Id);

        // Admin scope (null), filtered to roleA.
        var page = await Candidates().GetAllAsync(new CandidateListQuery(RoleId: roleA.Id, PageSize: 500), null);
        var ids = page.Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(inA.Id, ids);
        Assert.Contains(alsoInA.Id, ids);
        Assert.DoesNotContain(inB.Id, ids);
    }

    [Fact]
    public async Task Role_filter_is_intersected_with_recruiter_access_scope()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);

        var visibleInRole = Data.AddCandidate(ownerUserId: admin.Id, roleId: assignedRole.Id);

        // Filtering by a role the recruiter is NOT assigned to yields nothing (access wins).
        var otherRole = Data.AddRole();
        Data.AddCandidate(ownerUserId: admin.Id, roleId: otherRole.Id);

        var assigned = await Candidates().GetAllAsync(
            new CandidateListQuery(RoleId: assignedRole.Id, PageSize: 500), recruiter.Id);
        Assert.Contains(visibleInRole.Id, assigned.Items.Select(i => i.Id));

        var other = await Candidates().GetAllAsync(
            new CandidateListQuery(RoleId: otherRole.Id, PageSize: 500), recruiter.Id);
        Assert.Empty(other.Items);
    }

    [Fact]
    public async Task Delete_is_strict_owner_and_ignores_role_assignment()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(recruiterUserIds: recruiter.Id);
        var underRoleNotOwned = Data.AddCandidate(ownerUserId: admin.Id, roleId: role.Id);

        // Role assignment grants read/edit but NOT delete: the strict-owner scope returns false.
        Assert.False(await Candidates().DeleteAsync(underRoleNotOwned.Id, recruiter.Id));
        // Admin (null scope) can delete any.
        Assert.True(await Candidates().DeleteAsync(underRoleNotOwned.Id, null));
    }

    // ---- Role assignment enforcement on create/update (#97): a Recruiter may only file or ----
    // ---- reassign a candidate to a role they are an assigned recruiter of. ----

    private static CreateCandidateDto NewCandidateDto(int? roleId) => new(
        FullName: "Jane Doe",
        Email: $"{Guid.NewGuid():N}@test.local",
        Phone: null,
        CurrentTitle: null,
        RelevantExperience: "3 Years",
        Skills: null,
        Summary: null,
        LinkedInUrl: null,
        GithubUrl: null,
        PortfolioUrl: null,
        AppliedRole: null,
        IsReferred: false,
        ReferenceName: null,
        ReferenceEmail: null,
        ReferenceEmployeeId: null,
        RoleAppliedOptionId: roleId,
        SkillOptionIds: null,
        StoredFileName: $"{Guid.NewGuid():N}.pdf",
        OriginalFileName: "resume.pdf",
        FileType: "PDF",
        FileSizeBytes: 1000,
        InitialStatus: "Uploaded",
        InitialStatusComment: null);

    [Fact]
    public async Task Recruiter_cannot_create_a_candidate_under_an_unassigned_role()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var otherRole = Data.AddRole();

        var (created, duplicate, error) = await Candidates().CreateAsync(
            NewCandidateDto(otherRole.Id), recruiter.Id, recruiter.Name, scopeUserId: recruiter.Id);

        Assert.Null(created);
        Assert.Null(duplicate);
        Assert.Equal("You are not assigned to this job opening.", error);
    }

    [Fact]
    public async Task Recruiter_can_create_a_candidate_under_their_assigned_role()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);

        var (created, _, error) = await Candidates().CreateAsync(
            NewCandidateDto(assignedRole.Id), recruiter.Id, recruiter.Name, scopeUserId: recruiter.Id);

        Assert.Null(error);
        Assert.NotNull(created);
    }

    [Fact]
    public async Task Admin_can_create_a_candidate_under_any_role()
    {
        var admin = Data.AddUser(Roles.Admin);
        var otherRole = Data.AddRole();

        var (created, _, error) = await Candidates().CreateAsync(
            NewCandidateDto(otherRole.Id), admin.Id, "Admin", scopeUserId: null);

        Assert.Null(error);
        Assert.NotNull(created);
    }

    [Fact]
    public async Task Recruiter_cannot_reassign_a_candidate_to_an_unassigned_role()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var owned = Data.AddCandidate(ownerUserId: recruiter.Id);
        var otherRole = Data.AddRole();

        var dto = new UpdateCandidateDto(
            owned.FullName, owned.Email, null, null, "3 Years", null, null, null, null, null, null,
            IsReferred: false, null, null, null,
            RoleAppliedOptionId: otherRole.Id, SkillOptionIds: null);

        var (updated, error) = await Candidates().UpdateAsync(owned.Id, dto, recruiter.Id);

        Assert.Null(updated);
        Assert.Equal("You are not assigned to this job opening.", error);
    }

    [Fact]
    public async Task Recruiter_can_update_other_fields_without_touching_an_unassigned_current_role()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var otherRole = Data.AddRole(); // recruiter is NOT assigned to this one
        // Owned by the recruiter (candidate access via ownership), filed under a role they aren't on.
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id, roleId: otherRole.Id);

        var dto = new UpdateCandidateDto(
            "Updated Name", candidate.Email, null, null, "4 Years", null, null, null, null, null, null,
            IsReferred: false, null, null, null,
            RoleAppliedOptionId: otherRole.Id, SkillOptionIds: null); // role left unchanged

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, dto, recruiter.Id);

        Assert.Null(error);
        Assert.NotNull(updated);
        Assert.Equal("Updated Name", updated!.FullName);
    }

    [Fact]
    public async Task Recruiter_can_clear_a_candidates_role_with_no_assignment_check()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id, roleId: assignedRole.Id);

        var dto = new UpdateCandidateDto(
            candidate.FullName, candidate.Email, null, null, "3 Years", null, null, null, null, null, null,
            IsReferred: false, null, null, null,
            RoleAppliedOptionId: null, SkillOptionIds: null);

        var (updated, error) = await Candidates().UpdateAsync(candidate.Id, dto, recruiter.Id);

        Assert.Null(error);
        Assert.NotNull(updated);
        Assert.Null(updated!.RoleAppliedOptionId);
    }
}
