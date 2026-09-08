using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Manages the admin-configurable Role Applied and Skill lookup values.
/// Returned outcomes use a small result type so controllers can map to HTTP
/// (null name conflict, not found) without throwing.
/// </summary>
public class ConfigurationService(AppDbContext db)
{
    // ----- Role Applied options -----

    private async Task<Dictionary<int, int>> GetRoleCandidateCountsAsync() =>
        await db.Candidates
            .Where(c => c.RoleAppliedOptionId != null)
            .GroupBy(c => c.RoleAppliedOptionId!.Value)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count);

    public async Task<List<RoleAppliedOptionDto>> GetActiveRolesAsync()
    {
        var roles = await db.RoleAppliedOptions
            .Include(r => r.Recruiters).ThenInclude(rr => rr.User)
            .Include(r => r.EvaluationRubric)
            .Where(r => r.IsActive)
            .OrderBy(r => r.SortOrder).ThenBy(r => r.Name)
            .ToListAsync();
        var counts = await GetRoleCandidateCountsAsync();
        return roles.Select(r => ToDto(r, counts.GetValueOrDefault(r.Id, 0))).ToList();
    }

    public async Task<List<RoleAppliedOptionDto>> GetAllRolesAsync()
    {
        var roles = await db.RoleAppliedOptions
            .Include(r => r.Recruiters).ThenInclude(rr => rr.User)
            .Include(r => r.EvaluationRubric)
            .OrderBy(r => r.SortOrder).ThenBy(r => r.Name)
            .ToListAsync();
        var counts = await GetRoleCandidateCountsAsync();
        return roles.Select(r => ToDto(r, counts.GetValueOrDefault(r.Id, 0))).ToList();
    }

    /// <summary>
    /// Roles the given user is an assigned recruiter for. Active only by default (for the
    /// candidate forms); pass <paramref name="includeInactive"/> to also return inactive roles
    /// (for the candidate-list role filter, where closed openings must stay filterable).
    /// </summary>
    public async Task<List<RoleAppliedOptionDto>> GetAssignedRolesAsync(
        int recruiterUserId, bool includeInactive = false)
    {
        var roles = await db.RoleAppliedOptions
            .Include(r => r.Recruiters).ThenInclude(rr => rr.User)
            .Include(r => r.EvaluationRubric)
            .Where(r => (includeInactive || r.IsActive) && r.Recruiters.Any(rr => rr.UserId == recruiterUserId))
            .OrderBy(r => r.SortOrder).ThenBy(r => r.Name)
            .ToListAsync();
        var counts = await GetRoleCandidateCountsAsync();
        return roles.Select(r => ToDto(r, counts.GetValueOrDefault(r.Id, 0))).ToList();
    }

    public async Task<(RoleAppliedOptionDto? Created, bool Conflict, string? Error)> CreateRoleAsync(UpsertRoleAppliedOptionDto dto)
    {
        if (ValidateRole(dto) is string error) return (null, false, error);
        if (await ValidateRecruitersAsync(dto.RecruiterUserIds) is string recErr) return (null, false, recErr);
        if (dto.EvaluationRubricId is int rubricId && !await db.EvaluationRubrics.AnyAsync(r => r.Id == rubricId))
            return (null, false, "The selected evaluation rubric does not exist.");

        var name = dto.Name.Trim();
        if (await db.RoleAppliedOptions.AnyAsync(r => r.Name == name))
            return (null, true, null);

        var entity = new RoleAppliedOption
        {
            Name = name,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
            Location = Clean(dto.Location),
            Department = Clean(dto.Department),
            Priority = Clean(dto.Priority),
            EndDate = dto.EndDate,
            Recruiters = BuildRecruiters(dto.RecruiterUserIds),
            EvaluationRubricId = dto.EvaluationRubricId,
        };
        db.RoleAppliedOptions.Add(entity);
        await db.SaveChangesAsync();
        await LoadRecruitersAsync(entity);
        if (entity.EvaluationRubricId is not null)
            await db.Entry(entity).Reference(r => r.EvaluationRubric).LoadAsync();
        return (ToDto(entity), false, null);
    }

    public async Task<(RoleAppliedOptionDto? Updated, bool NotFound, bool Conflict, string? Error)> UpdateRoleAsync(int id, UpsertRoleAppliedOptionDto dto)
    {
        if (ValidateRole(dto) is string error) return (null, false, false, error);
        if (await ValidateRecruitersAsync(dto.RecruiterUserIds) is string recErr) return (null, false, false, recErr);
        if (dto.EvaluationRubricId is int rubricId && !await db.EvaluationRubrics.AnyAsync(r => r.Id == rubricId))
            return (null, false, false, "The selected evaluation rubric does not exist.");

        var entity = await db.RoleAppliedOptions
            .Include(r => r.Recruiters)
            .Include(r => r.EvaluationRubric)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null) return (null, true, false, null);

        var name = dto.Name.Trim();
        if (await db.RoleAppliedOptions.AnyAsync(r => r.Id != id && r.Name == name))
            return (null, false, true, null);

        entity.Name = name;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.Location = Clean(dto.Location);
        entity.Department = Clean(dto.Department);
        entity.Priority = Clean(dto.Priority);
        entity.EndDate = dto.EndDate;
        entity.EvaluationRubricId = dto.EvaluationRubricId;
        // Replace the recruiter assignments with the new selection.
        entity.Recruiters.Clear();
        foreach (var uid in (dto.RecruiterUserIds ?? []).Distinct())
            entity.Recruiters.Add(new RoleRecruiter { UserId = uid });
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await LoadRecruitersAsync(entity);
        if (entity.EvaluationRubricId is not null)
            await db.Entry(entity).Reference(r => r.EvaluationRubric).LoadAsync();
        return (ToDto(entity), false, false, null);
    }

    private static List<RoleRecruiter> BuildRecruiters(List<int>? ids) =>
        (ids ?? []).Distinct().Select(uid => new RoleRecruiter { UserId = uid }).ToList();

    private async Task LoadRecruitersAsync(RoleAppliedOption entity) =>
        await db.Entry(entity).Collection(e => e.Recruiters).Query().Include(rr => rr.User).LoadAsync();

    /// <summary>Validates required fields and the Location/Department option sets. Null when valid.</summary>
    private static string? ValidateRole(UpsertRoleAppliedOptionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return "Role name is required.";
        if (dto.EndDate == default)
            return "End date is required.";
        if (dto.Location is not null && !JobOpeningOptions.Locations.Contains(dto.Location))
            return "Invalid location.";
        if (dto.Department is not null && !JobOpeningOptions.Departments.Contains(dto.Department))
            return "Invalid department.";
        return null;
    }

    /// <summary>
    /// Every assigned recruiter (when any) must be an existing active user that can actually write
    /// candidates. Assigning an Interviewer would save fine but grant nothing, since
    /// <c>CandidatesController</c> is gated on <see cref="Roles.CanWriteCandidate"/> — so reject it
    /// here rather than let the assignment silently do nothing. Null when valid.
    /// </summary>
    private async Task<string?> ValidateRecruitersAsync(List<int>? recruiterUserIds)
    {
        if (recruiterUserIds is not { Count: > 0 }) return null;
        var ids = recruiterUserIds.Distinct().ToList();

        var users = await db.Users
            .Where(u => ids.Contains(u.Id) && u.IsActive)
            .Select(u => new { u.Name, Roles = u.Roles.Select(ur => ur.Role).ToList() })
            .ToListAsync();

        if (users.Count != ids.Count)
            return "One or more selected recruiters are not valid active users.";

        var ineligible = users
            .Where(u => !u.Roles.Any(Roles.CanWriteCandidateRoles.Contains))
            .Select(u => u.Name)
            .ToList();

        return ineligible.Count == 0
            ? null
            : $"These users need the Recruiter role or higher to be assigned as a recruiter: {string.Join(", ", ineligible)}.";
    }

    /// <summary>Active users eligible to be a job opening's recruiter (Recruiter role or higher).</summary>
    public async Task<List<AssignableUserDto>> GetRecruiterOptionsAsync()
    {
        // Bound to a local so EF parameterizes the list instead of trying to evaluate the static field.
        var eligibleRoles = Roles.CanWriteCandidateRoles;
        return await db.Users
            .Where(u => u.IsActive && u.Roles.Any(ur => eligibleRoles.Contains(ur.Role)))
            .OrderBy(u => u.Name)
            .Select(u => new AssignableUserDto(u.Id, u.Name, u.Email))
            .ToListAsync();
    }

    /// <summary>Trim to null so empty strings aren't persisted.</summary>
    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>
    /// Soft-disable when referenced by candidates (returns the count); otherwise hard delete.
    /// <c>Found</c> is false when the role doesn't exist.
    /// </summary>
    public async Task<(bool Found, bool Deleted, bool Deactivated, int CandidateCount)> DeleteRoleAsync(int id)
    {
        var entity = await db.RoleAppliedOptions.FindAsync(id);
        if (entity is null) return (false, false, false, 0);

        var candidateCount = await db.Candidates.CountAsync(c => c.RoleAppliedOptionId == id);
        if (candidateCount > 0)
        {
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return (true, false, true, candidateCount);
        }

        db.RoleAppliedOptions.Remove(entity);
        await db.SaveChangesAsync();
        return (true, true, false, 0);
    }

    // ----- Skill options -----

    public async Task<List<SkillOptionDto>> GetActiveSkillsAsync() =>
        await db.SkillOptions
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new SkillOptionDto(s.Id, s.Name, s.SortOrder, s.IsActive))
            .ToListAsync();

    public async Task<List<SkillOptionDto>> GetAllSkillsAsync() =>
        await db.SkillOptions
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new SkillOptionDto(s.Id, s.Name, s.SortOrder, s.IsActive))
            .ToListAsync();

    public async Task<(SkillOptionDto? Created, bool Conflict)> CreateSkillAsync(UpsertSkillOptionDto dto)
    {
        var name = dto.Name.Trim();
        if (await db.SkillOptions.AnyAsync(s => s.Name == name))
            return (null, true);

        var entity = new SkillOption { Name = name, SortOrder = dto.SortOrder, IsActive = dto.IsActive };
        db.SkillOptions.Add(entity);
        await db.SaveChangesAsync();
        return (ToDto(entity), false);
    }

    public async Task<(SkillOptionDto? Updated, bool NotFound, bool Conflict)> UpdateSkillAsync(int id, UpsertSkillOptionDto dto)
    {
        var entity = await db.SkillOptions.FindAsync(id);
        if (entity is null) return (null, true, false);

        var name = dto.Name.Trim();
        if (await db.SkillOptions.AnyAsync(s => s.Id != id && s.Name == name))
            return (null, false, true);

        entity.Name = name;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (ToDto(entity), false, false);
    }

    public async Task<bool> DeleteSkillAsync(int id)
    {
        var entity = await db.SkillOptions.FindAsync(id);
        if (entity is null) return false;

        var inUse = await db.CandidateSkills.AnyAsync(cs => cs.SkillOptionId == id);
        if (inUse)
        {
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.SkillOptions.Remove(entity);
        }
        await db.SaveChangesAsync();
        return true;
    }

    // ----- Candidate source options -----

    public async Task<List<CandidateSourceOptionDto>> GetActiveSourcesAsync() =>
        await db.CandidateSourceOptions
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new CandidateSourceOptionDto(s.Id, s.Name, s.SortOrder, s.IsActive))
            .ToListAsync();

    public async Task<List<CandidateSourceOptionDto>> GetAllSourcesAsync() =>
        await db.CandidateSourceOptions
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new CandidateSourceOptionDto(s.Id, s.Name, s.SortOrder, s.IsActive))
            .ToListAsync();

    public async Task<(CandidateSourceOptionDto? Created, bool Conflict)> CreateSourceAsync(UpsertCandidateSourceOptionDto dto)
    {
        var name = dto.Name.Trim();
        if (await db.CandidateSourceOptions.AnyAsync(s => s.Name == name))
            return (null, true);

        var entity = new CandidateSourceOption { Name = name, SortOrder = dto.SortOrder, IsActive = dto.IsActive };
        db.CandidateSourceOptions.Add(entity);
        await db.SaveChangesAsync();
        return (ToDto(entity), false);
    }

    public async Task<(CandidateSourceOptionDto? Updated, bool NotFound, bool Conflict)> UpdateSourceAsync(
        int id, UpsertCandidateSourceOptionDto dto)
    {
        var entity = await db.CandidateSourceOptions.FindAsync(id);
        if (entity is null) return (null, true, false);

        var name = dto.Name.Trim();
        if (await db.CandidateSourceOptions.AnyAsync(s => s.Id != id && s.Name == name))
            return (null, false, true);

        entity.Name = name;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (ToDto(entity), false, false);
    }

    /// <summary>
    /// Soft-disable when candidates reference it (returns the count); otherwise hard delete.
    /// Shaped like <see cref="DeleteRoleAsync"/> rather than the simpler skill delete, because a
    /// source is a single-valued FK on Candidate — the count is what the UI reports back.
    /// </summary>
    public async Task<(bool Found, bool Deleted, bool Deactivated, int CandidateCount)> DeleteSourceAsync(int id)
    {
        var entity = await db.CandidateSourceOptions.FindAsync(id);
        if (entity is null) return (false, false, false, 0);

        var candidateCount = await db.Candidates.CountAsync(c => c.SourceOptionId == id);
        if (candidateCount > 0)
        {
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return (true, false, true, candidateCount);
        }

        db.CandidateSourceOptions.Remove(entity);
        await db.SaveChangesAsync();
        return (true, true, false, 0);
    }

    // ----- Interview type options -----

    public async Task<List<InterviewTypeOptionDto>> GetActiveInterviewTypesAsync() =>
        await db.InterviewTypeOptions
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => new InterviewTypeOptionDto(t.Id, t.Name, t.SortOrder, t.IsActive))
            .ToListAsync();

    public async Task<List<InterviewTypeOptionDto>> GetAllInterviewTypesAsync() =>
        await db.InterviewTypeOptions
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => new InterviewTypeOptionDto(t.Id, t.Name, t.SortOrder, t.IsActive))
            .ToListAsync();

    public async Task<(InterviewTypeOptionDto? Created, bool Conflict)> CreateInterviewTypeAsync(UpsertInterviewTypeOptionDto dto)
    {
        var name = dto.Name.Trim();
        if (await db.InterviewTypeOptions.AnyAsync(t => t.Name == name))
            return (null, true);

        var entity = new InterviewTypeOption { Name = name, SortOrder = dto.SortOrder, IsActive = dto.IsActive };
        db.InterviewTypeOptions.Add(entity);
        await db.SaveChangesAsync();
        return (ToDto(entity), false);
    }

    public async Task<(InterviewTypeOptionDto? Updated, bool NotFound, bool Conflict)> UpdateInterviewTypeAsync(int id, UpsertInterviewTypeOptionDto dto)
    {
        var entity = await db.InterviewTypeOptions.FindAsync(id);
        if (entity is null) return (null, true, false);

        var name = dto.Name.Trim();
        if (await db.InterviewTypeOptions.AnyAsync(t => t.Id != id && t.Name == name))
            return (null, false, true);

        entity.Name = name;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (ToDto(entity), false, false);
    }

    public async Task<bool> DeleteInterviewTypeAsync(int id)
    {
        var entity = await db.InterviewTypeOptions.FindAsync(id);
        if (entity is null) return false;

        var inUse = await db.InterviewTags.AnyAsync(t => t.InterviewTypeOptionId == id);
        if (inUse)
        {
            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.InterviewTypeOptions.Remove(entity);
        }
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>Auto-generated title: role name + the posted (created) date.</summary>
    public static string RoleTitle(string name, DateTime createdAt) => $"{name} — {createdAt:dd MMM yyyy}";

    private static RoleAppliedOptionDto ToDto(RoleAppliedOption r, int candidateCount = 0) =>
        new(r.Id, r.Name, r.SortOrder, r.IsActive, r.Location, r.Department, r.Priority,
            r.CreatedAt, r.EndDate, RoleTitle(r.Name, r.CreatedAt),
            r.Recruiters
                .Select(rr => new RecruiterDto(rr.UserId, rr.User.Name))
                .OrderBy(x => x.Name).ToList(),
            r.EvaluationRubricId,
            r.EvaluationRubric?.Name,
            candidateCount);
    private static SkillOptionDto ToDto(SkillOption s) => new(s.Id, s.Name, s.SortOrder, s.IsActive);
    private static CandidateSourceOptionDto ToDto(CandidateSourceOption s) => new(s.Id, s.Name, s.SortOrder, s.IsActive);
    private static InterviewTypeOptionDto ToDto(InterviewTypeOption t) => new(t.Id, t.Name, t.SortOrder, t.IsActive);
}
