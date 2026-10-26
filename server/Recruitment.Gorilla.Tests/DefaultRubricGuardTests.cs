using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The default evaluation rubric is what every candidate without an opening rubric is scored on, so it
/// must always exist and be usable (#191). Deactivating it, or clearing its default flag, left the page
/// and the server resolving different rubrics, and every save then failed.
/// </summary>
public class DefaultRubricGuardTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<EvaluationRubric> DefaultRubricAsync() =>
        await Db.EvaluationRubrics.Include(r => r.Criteria).AsNoTracking().FirstAsync(r => r.IsDefault && r.IsActive);

    private static UpsertEvaluationRubricDto Same(EvaluationRubric r, bool? isDefault = null, bool? isActive = null) =>
        new(r.Name, r.Description, isDefault ?? r.IsDefault, isActive ?? r.IsActive,
            r.Criteria.OrderBy(c => c.SortOrder)
                .Select(c => new UpsertRubricCriterionDto(null, c.SectionName, c.Key, c.Label, c.Hint, c.Weight, c.SortOrder))
                .ToList());

    private async Task<EvaluationRubric> NewRubricAsync(string name, string key, User admin)
    {
        var (created, error, _) = await EvaluationRubrics().CreateAsync(new UpsertEvaluationRubricDto(
            name, null, false, true, [new(null, "Testing", key, key, null, 1.0, 1)]), admin.Id);
        Assert.Null(error);
        return await Db.EvaluationRubrics.Include(r => r.Criteria).AsNoTracking().SingleAsync(r => r.Id == created!.Id);
    }

    [Fact]
    public async Task Deactivating_the_default_rubric_is_refused_and_changes_nothing()
    {
        var admin = Data.AddUser(Roles.Admin);
        var rubric = await DefaultRubricAsync();

        var (updated, error, notFound, _) = await EvaluationRubrics().UpdateAsync(rubric.Id, Same(rubric, isActive: false), admin.Id);

        Assert.Null(updated);
        Assert.False(notFound);
        Assert.Contains("default", error, StringComparison.OrdinalIgnoreCase);
        var stored = await Db.EvaluationRubrics.AsNoTracking().SingleAsync(r => r.Id == rubric.Id);
        Assert.True(stored.IsActive);
        Assert.True(stored.IsDefault);
    }

    [Fact]
    public async Task Clearing_the_default_flag_is_refused_too()
    {
        var admin = Data.AddUser(Roles.Admin);
        var rubric = await DefaultRubricAsync();

        var (updated, error, _, _) = await EvaluationRubrics().UpdateAsync(rubric.Id, Same(rubric, isDefault: false), admin.Id);

        Assert.Null(updated);
        Assert.Contains("another rubric", error, StringComparison.OrdinalIgnoreCase);
        Assert.True((await Db.EvaluationRubrics.AsNoTracking().SingleAsync(r => r.Id == rubric.Id)).IsDefault);
    }

    [Fact]
    public async Task The_default_rubric_can_still_be_edited_while_it_stays_default_and_active()
    {
        var admin = Data.AddUser(Roles.Admin);
        var rubric = await DefaultRubricAsync();
        var dto = Same(rubric) with { Description = "Reworded description" };

        var (updated, error, _, _) = await EvaluationRubrics().UpdateAsync(rubric.Id, dto, admin.Id);

        Assert.Null(error);
        Assert.Equal("Reworded description", updated!.Description);
        Assert.True(updated.IsDefault);
        Assert.True(updated.IsActive);
    }

    [Fact]
    public async Task A_rubric_that_is_not_the_default_can_still_be_deactivated()
    {
        var admin = Data.AddUser(Roles.Admin);
        var stored = await NewRubricAsync("Side rubric", "SideKey", admin);

        var (updated, error, _, _) = await EvaluationRubrics().UpdateAsync(stored.Id, Same(stored, isActive: false), admin.Id);

        Assert.Null(error);
        Assert.False(updated!.IsActive);
    }

    [Fact]
    public async Task Making_another_rubric_the_default_moves_the_flag_and_frees_the_old_one_to_be_deactivated()
    {
        var admin = Data.AddUser(Roles.Admin);
        var original = await DefaultRubricAsync();
        var stored = await NewRubricAsync("New default", "NewDefaultKey", admin);

        var (updated, error, _, _) = await EvaluationRubrics().UpdateAsync(stored.Id, Same(stored, isDefault: true), admin.Id);

        Assert.Null(error);
        Assert.True(updated!.IsDefault);
        var old = await Db.EvaluationRubrics.Include(r => r.Criteria).AsNoTracking().SingleAsync(r => r.Id == original.Id);
        Assert.False(old.IsDefault);

        // It is no longer the default, so it may now be deactivated.
        var (_, oldError, _, _) = await EvaluationRubrics().UpdateAsync(old.Id, Same(old, isActive: false), admin.Id);
        Assert.Null(oldError);
    }
}
