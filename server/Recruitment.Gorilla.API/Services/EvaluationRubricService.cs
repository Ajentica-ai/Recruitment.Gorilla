using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class EvaluationRubricService(AppDbContext db, AuditService audit)
{
    public async Task<List<EvaluationRubricDto>> GetAllAsync()
    {
        var rubrics = await db.EvaluationRubrics
            .Include(r => r.Criteria)
            .Include(r => r.RoleAppliedOptions)
            .OrderByDescending(r => r.IsDefault)
            .ThenBy(r => r.Name)
            .ToListAsync();

        return rubrics.Select(ToDto).ToList();
    }

    public async Task<EvaluationRubricDto?> GetByIdAsync(int id)
    {
        var rubric = await db.EvaluationRubrics
            .Include(r => r.Criteria)
            .Include(r => r.RoleAppliedOptions)
            .FirstOrDefaultAsync(r => r.Id == id);

        return rubric is null ? null : ToDto(rubric);
    }

    /// <summary>
    /// The rubric an interview is scored against, as a DTO: see <see cref="ResolveAsync"/>. Null when the
    /// interview does not exist or no rubric exists at all.
    /// </summary>
    public async Task<EvaluationRubricDto?> GetForInterviewAsync(int interviewId)
    {
        var candidate = await db.Interviews
            .Where(i => i.Id == interviewId)
            .Select(i => new { i.Candidate.RoleAppliedOptionId, i.Candidate.AppliedRole })
            .FirstOrDefaultAsync();
        if (candidate is null) return null;

        var rubric = await ResolveAsync(db, candidate.RoleAppliedOptionId, candidate.AppliedRole);
        return rubric is null ? null : ToDto(rubric);
    }

    /// <summary>
    /// The single rule for which rubric a candidate's interviews use (#188), shared by the rubric endpoint
    /// and by evaluation validation so they cannot disagree. The candidate's job opening is found by
    /// <c>RoleAppliedOptionId</c>, which is what the UI sets. The legacy free-text <c>AppliedRole</c> is
    /// matched by opening name only when there is no link, so candidates from before the link existed keep
    /// working (and a rename of an opening cannot break a linked candidate). The opening's rubric counts
    /// only if it is active and has criteria; otherwise the default active rubric, then any active one.
    /// </summary>
    public static async Task<EvaluationRubric?> ResolveAsync(AppDbContext db, int? roleAppliedOptionId, string? legacyRoleName)
    {
        IQueryable<RoleAppliedOption> openings = db.RoleAppliedOptions
            .Include(r => r.EvaluationRubric).ThenInclude(er => er!.Criteria)
            .Include(r => r.EvaluationRubric).ThenInclude(er => er!.RoleAppliedOptions);

        RoleAppliedOption? opening = null;
        if (roleAppliedOptionId is int roleId)
            opening = await openings.FirstOrDefaultAsync(r => r.Id == roleId);
        else if (!string.IsNullOrWhiteSpace(legacyRoleName))
            opening = await openings.FirstOrDefaultAsync(r => r.Name == legacyRoleName);

        if (opening?.EvaluationRubric is { IsActive: true } own && own.Criteria.Count > 0)
            return own;

        return await db.EvaluationRubrics
                   .Include(r => r.Criteria)
                   .Include(r => r.RoleAppliedOptions)
                   .FirstOrDefaultAsync(r => r.IsDefault && r.IsActive)
               ?? await db.EvaluationRubrics
                   .Include(r => r.Criteria)
                   .Include(r => r.RoleAppliedOptions)
                   .FirstOrDefaultAsync(r => r.IsActive);
    }

    public async Task<(EvaluationRubricDto? Rubric, string? Error, bool Conflict)> CreateAsync(
        UpsertEvaluationRubricDto dto, int userId)
    {
        var name = dto.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return (null, "Rubric name is required.", false);

        if (await db.EvaluationRubrics.AnyAsync(r => r.Name == name))
            return (null, "A rubric with this name already exists.", true);

        if (dto.Criteria is null || dto.Criteria.Count == 0)
            return (null, "At least one evaluation criterion is required.", false);

        var keyErrors = ValidateCriteria(dto.Criteria);
        if (keyErrors is not null)
            return (null, keyErrors, false);

        if (dto.IsDefault)
        {
            var existingDefaults = await db.EvaluationRubrics.Where(r => r.IsDefault).ToListAsync();
            foreach (var d in existingDefaults) d.IsDefault = false;
        }

        var rubric = new EvaluationRubric
        {
            Name = name,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsDefault = dto.IsDefault,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Criteria = dto.Criteria.Select((c, idx) => new RubricCriterion
            {
                SectionName = string.IsNullOrWhiteSpace(c.SectionName) ? "General" : c.SectionName.Trim(),
                Key = c.Key.Trim(),
                Label = c.Label.Trim(),
                Hint = string.IsNullOrWhiteSpace(c.Hint) ? null : c.Hint.Trim(),
                Weight = c.Weight is > 0 ? c.Weight.Value : 1.0,
                SortOrder = c.SortOrder ?? (idx + 1),
            }).ToList()
        };

        db.EvaluationRubrics.Add(rubric);
        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationRubric.Created", entityType: "EvaluationRubric", entityId: rubric.Id,
            summary: $"Created evaluation rubric scorecard '{rubric.Name}' with {rubric.Criteria.Count} criteria.");

        return (ToDto(rubric), null, false);
    }

    public async Task<(EvaluationRubricDto? Rubric, string? Error, bool NotFound, bool Conflict)> UpdateAsync(
        int id, UpsertEvaluationRubricDto dto, int userId)
    {
        var rubric = await db.EvaluationRubrics
            .Include(r => r.Criteria)
            .Include(r => r.RoleAppliedOptions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (rubric is null) return (null, null, true, false);

        var name = dto.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return (null, "Rubric name is required.", false, false);

        if (await db.EvaluationRubrics.AnyAsync(r => r.Id != id && r.Name == name))
            return (null, "A rubric with this name already exists.", false, true);

        if (dto.Criteria is null || dto.Criteria.Count == 0)
            return (null, "At least one evaluation criterion is required.", false, false);

        var keyErrors = ValidateCriteria(dto.Criteria);
        if (keyErrors is not null)
            return (null, keyErrors, false, false);

        if (dto.IsDefault && !rubric.IsDefault)
        {
            var otherDefaults = await db.EvaluationRubrics.Where(r => r.Id != id && r.IsDefault).ToListAsync();
            foreach (var d in otherDefaults) d.IsDefault = false;
        }

        rubric.Name = name;
        rubric.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        rubric.IsDefault = dto.IsDefault;
        rubric.IsActive = dto.IsActive;
        rubric.UpdatedAt = DateTime.UtcNow;

        // Replace criteria collection
        db.RubricCriteria.RemoveRange(rubric.Criteria);
        rubric.Criteria = dto.Criteria.Select((c, idx) => new RubricCriterion
        {
            EvaluationRubricId = rubric.Id,
            SectionName = string.IsNullOrWhiteSpace(c.SectionName) ? "General" : c.SectionName.Trim(),
            Key = c.Key.Trim(),
            Label = c.Label.Trim(),
            Hint = string.IsNullOrWhiteSpace(c.Hint) ? null : c.Hint.Trim(),
            Weight = c.Weight is > 0 ? c.Weight.Value : 1.0,
            SortOrder = c.SortOrder ?? (idx + 1),
        }).ToList();

        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationRubric.Updated", entityType: "EvaluationRubric", entityId: rubric.Id,
            summary: $"Updated evaluation rubric scorecard '{rubric.Name}'.");

        return (ToDto(rubric), null, false, false);
    }

    public async Task<(bool Success, string? Error, bool NotFound)> DeleteAsync(int id, int userId)
    {
        var rubric = await db.EvaluationRubrics
            .Include(r => r.RoleAppliedOptions)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (rubric is null) return (false, null, true);

        if (rubric.IsDefault)
            return (false, "The default evaluation rubric cannot be deleted. Designate another rubric as default first.", false);

        var name = rubric.Name;
        db.EvaluationRubrics.Remove(rubric);
        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationRubric.Deleted", entityType: "EvaluationRubric", entityId: id,
            summary: $"Deleted evaluation rubric scorecard '{name}'.");

        return (true, null, false);
    }

    public async Task<(EvaluationRubricDto? Rubric, string? Error, bool NotFound)> CloneAsync(int id, int userId)
    {
        var source = await db.EvaluationRubrics
            .Include(r => r.Criteria)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (source is null) return (null, null, true);

        var baseName = $"{source.Name} (Copy)";
        var name = baseName;
        var counter = 1;
        while (await db.EvaluationRubrics.AnyAsync(r => r.Name == name))
        {
            counter++;
            name = $"{source.Name} (Copy {counter})";
        }

        var clone = new EvaluationRubric
        {
            Name = name,
            Description = source.Description,
            IsDefault = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Criteria = source.Criteria
                .OrderBy(c => c.SortOrder)
                .Select(c => new RubricCriterion
                {
                    SectionName = c.SectionName,
                    Key = c.Key,
                    Label = c.Label,
                    Hint = c.Hint,
                    Weight = c.Weight,
                    SortOrder = c.SortOrder,
                }).ToList()
        };

        db.EvaluationRubrics.Add(clone);
        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationRubric.Created", entityType: "EvaluationRubric", entityId: clone.Id,
            summary: $"Cloned evaluation rubric scorecard from '{source.Name}' to '{clone.Name}'.");

        return (ToDto(clone), null, false);
    }

    public async Task<(bool Success, string? Error, bool NotFound)> SetDefaultAsync(int id, int userId)
    {
        var rubric = await db.EvaluationRubrics.FirstOrDefaultAsync(r => r.Id == id);
        if (rubric is null) return (false, null, true);

        var all = await db.EvaluationRubrics.ToListAsync();
        foreach (var r in all)
        {
            r.IsDefault = (r.Id == id);
            if (r.Id == id) r.IsActive = true;
        }

        await db.SaveChangesAsync();

        await audit.RecordAsync("EvaluationRubric.Updated", entityType: "EvaluationRubric", entityId: id,
            summary: $"Set evaluation rubric '{rubric.Name}' as system default.");

        return (true, null, false);
    }

    private static string? ValidateCriteria(List<UpsertRubricCriterionDto> criteria)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in criteria)
        {
            if (string.IsNullOrWhiteSpace(c.Key))
                return "All criteria must have a unique identifier key.";
            if (string.IsNullOrWhiteSpace(c.Label))
                return "All criteria must have a descriptive label.";
            if (!keys.Add(c.Key.Trim()))
                return $"Duplicate criterion key '{c.Key.Trim()}'. Each criterion must have a unique key.";
        }
        return null;
    }

    private static EvaluationRubricDto ToDto(EvaluationRubric r) =>
        new(
            r.Id,
            r.Name,
            r.Description,
            r.IsDefault,
            r.IsActive,
            r.Criteria.Count,
            r.RoleAppliedOptions?.Count ?? 0,
            r.Criteria
                .OrderBy(c => c.SortOrder)
                .Select(c => new RubricCriterionDto(
                    c.Id,
                    c.EvaluationRubricId,
                    c.SectionName,
                    c.Key,
                    c.Label,
                    c.Hint,
                    c.Weight,
                    c.SortOrder))
                .ToList(),
            r.CreatedAt,
            r.UpdatedAt
        );
}
