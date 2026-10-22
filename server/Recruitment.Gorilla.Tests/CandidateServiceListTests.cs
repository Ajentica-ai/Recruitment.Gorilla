using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>Candidate list filters (phone search, skills, referred) and whitelisted sorting.</summary>
public class CandidateServiceListTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private Task<PagedResult<CandidateListItemDto>> List(CandidateListQuery q, int? scope = null) =>
        Candidates().GetAllAsync(q with { PageSize = 500 }, scope);

    [Fact]
    public async Task Search_matches_phone_as_well_as_name_and_email()
    {
        var withPhone = Data.AddCandidate(phone: "+880-1712-999888");
        var other = Data.AddCandidate(phone: "+880-1555-000111");

        var byPhone = await List(new CandidateListQuery(Search: "1712-999"));
        Assert.Contains(withPhone.Id, byPhone.Items.Select(i => i.Id));
        Assert.DoesNotContain(other.Id, byPhone.Items.Select(i => i.Id));

        // name/email search still works
        var byName = await List(new CandidateListQuery(Search: withPhone.FullName));
        Assert.Contains(withPhone.Id, byName.Items.Select(i => i.Id));
    }

    /// <summary>
    /// The dashboard's KPI tiles link into this list, so a bucket must select
    /// exactly the set the matching tile counts. "rejected" in particular spans
    /// four statuses, which the single-value Status filter cannot express — that
    /// mismatch is why the bucket filter exists.
    /// </summary>
    [Fact]
    public async Task Bucket_rejected_covers_every_negative_terminal_status()
    {
        var rejected = Data.AddCandidate(status: "Reject");
        var notRecommended = Data.AddCandidate(status: "Not Recommended");
        var discontinued = Data.AddCandidate(status: "Discontinued");
        var notAvailable = Data.AddCandidate(status: "Not Available");
        var recommended = Data.AddCandidate(status: "Recommended");
        var inFlight = Data.AddCandidate(status: "Uploaded");

        var ids = (await List(new CandidateListQuery(Bucket: CandidateBuckets.Rejected)))
            .Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(rejected.Id, ids);
        Assert.Contains(notRecommended.Id, ids);
        Assert.Contains(discontinued.Id, ids);
        Assert.Contains(notAvailable.Id, ids);
        Assert.DoesNotContain(recommended.Id, ids);
        Assert.DoesNotContain(inFlight.Id, ids);
    }

    [Fact]
    public async Task Bucket_in_process_is_everything_not_yet_terminal()
    {
        var uploaded = Data.AddCandidate(status: "Uploaded");
        var interviewing = Data.AddCandidate(status: "Interview Scheduled");
        var recommended = Data.AddCandidate(status: "Recommended");
        var rejected = Data.AddCandidate(status: "Discontinued");

        var ids = (await List(new CandidateListQuery(Bucket: CandidateBuckets.InProcess)))
            .Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(uploaded.Id, ids);
        Assert.Contains(interviewing.Id, ids);
        Assert.DoesNotContain(recommended.Id, ids);
        Assert.DoesNotContain(rejected.Id, ids);
    }

    [Fact]
    public async Task Bucket_recommended_selects_only_the_positive_terminal_status()
    {
        var recommended = Data.AddCandidate(status: "Recommended");
        var other = Data.AddCandidate(status: "Uploaded");

        var ids = (await List(new CandidateListQuery(Bucket: CandidateBuckets.Recommended)))
            .Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(recommended.Id, ids);
        Assert.DoesNotContain(other.Id, ids);
    }

    /// <summary>A stale or hand-edited link must degrade to an unfiltered list,
    /// not throw and not silently return nothing.</summary>
    [Fact]
    public async Task Unknown_bucket_is_ignored_rather_than_excluding_everything()
    {
        var candidate = Data.AddCandidate();

        var ids = (await List(new CandidateListQuery(Bucket: "not-a-bucket")))
            .Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(candidate.Id, ids);
    }

    [Fact]
    public async Task Skill_filter_is_any_of_and_excludes_candidates_without_a_selected_skill()
    {
        var csharp = Data.AddSkill();
        var sql = Data.AddSkill();
        var python = Data.AddSkill();

        var hasCsharp = Data.AddCandidate(skillIds: [csharp.Id]);
        var hasSql = Data.AddCandidate(skillIds: [sql.Id]);
        var hasPython = Data.AddCandidate(skillIds: [python.Id]);
        var hasNone = Data.AddCandidate();

        var page = await List(new CandidateListQuery(SkillIds: [csharp.Id, sql.Id]));
        var ids = page.Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(hasCsharp.Id, ids); // ANY-of
        Assert.Contains(hasSql.Id, ids);
        Assert.DoesNotContain(hasPython.Id, ids);
        Assert.DoesNotContain(hasNone.Id, ids);
    }

    [Fact]
    public async Task Skill_filter_is_intersected_with_recruiter_access_scope()
    {
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var assignedRole = Data.AddRole(recruiterUserIds: recruiter.Id);
        var otherRole = Data.AddRole();
        var skill = Data.AddSkill();

        var visible = Data.AddCandidate(ownerUserId: admin.Id, roleId: assignedRole.Id, skillIds: [skill.Id]);
        var hidden = Data.AddCandidate(ownerUserId: admin.Id, roleId: otherRole.Id, skillIds: [skill.Id]);

        var page = await List(new CandidateListQuery(SkillIds: [skill.Id]), recruiter.Id);
        var ids = page.Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(visible.Id, ids);
        Assert.DoesNotContain(hidden.Id, ids); // same skill, but outside access scope
    }

    [Fact]
    public async Task ReferredOnly_returns_only_referred_candidates()
    {
        var referred = Data.AddCandidate(isReferred: true);
        var notReferred = Data.AddCandidate();

        var page = await List(new CandidateListQuery(ReferredOnly: true));
        var ids = page.Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(referred.Id, ids);
        Assert.DoesNotContain(notReferred.Id, ids);
    }

    [Fact]
    public async Task Sort_by_name_asc_orders_alphabetically_and_junk_sort_falls_back()
    {
        // Distinctive prefixes so ordering is deterministic among just these rows.
        var role = Data.AddRole();
        var b = Data.AddCandidate(roleId: role.Id);
        var a = Data.AddCandidate(roleId: role.Id);
        Db.Candidates.Find(a.Id)!.FullName = "AAA Sort Test";
        Db.Candidates.Find(b.Id)!.FullName = "BBB Sort Test";
        await Db.SaveChangesAsync();

        var asc = await List(new CandidateListQuery(RoleId: role.Id, Sort: "name", Dir: "asc"));
        Assert.Equal(["AAA Sort Test", "BBB Sort Test"], asc.Items.Select(i => i.FullName).ToArray());

        var desc = await List(new CandidateListQuery(RoleId: role.Id, Sort: "name", Dir: "desc"));
        Assert.Equal(["BBB Sort Test", "AAA Sort Test"], desc.Items.Select(i => i.FullName).ToArray());

        // Unknown sort key falls back to CreatedAt desc without throwing.
        var junk = await List(new CandidateListQuery(RoleId: role.Id, Sort: "; DROP TABLE Candidates"));
        Assert.Equal(2, junk.Items.Count);
    }

    [Fact]
    public async Task Batch_filter_returns_only_candidates_matching_batch_label()
    {
        var role = Data.AddRole();
        var c1 = Data.AddCandidate(roleId: role.Id);
        var c2 = Data.AddCandidate(roleId: role.Id);
        Db.Candidates.Find(c1.Id)!.BatchName = "Batch 2026 Alpha";
        Db.Candidates.Find(c2.Id)!.BatchName = "Batch 2026 Beta";
        await Db.SaveChangesAsync();

        var page = await List(new CandidateListQuery(RoleId: role.Id, Batch: "Batch 2026 Alpha"));
        var ids = page.Items.Select(i => i.Id).ToHashSet();

        Assert.Contains(c1.Id, ids);
        Assert.DoesNotContain(c2.Id, ids);
        Assert.Equal("Batch 2026 Alpha", page.Items.First(i => i.Id == c1.Id).BatchName);
    }
}

/// <summary>The hired and offers buckets (#195): accepted by the API but never filtered on, so they returned everyone.</summary>
public class CandidateServiceBucketTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private async Task<List<int>> Ids(string bucket, int? scope = null) =>
        (await Candidates().GetAllAsync(new CandidateListQuery(Bucket: bucket, PageSize: 500), scope))
            .Items.Select(i => i.Id).ToList();

    [Fact]
    public async Task Bucket_hired_returns_only_hired_candidates()
    {
        var hired = Data.AddCandidate(status: "Hired");
        var accepted = Data.AddCandidate(status: "Offer Accepted");
        var uploaded = Data.AddCandidate(status: "Uploaded");

        var ids = await Ids(CandidateBuckets.Hired);

        Assert.Contains(hired.Id, ids);
        Assert.DoesNotContain(accepted.Id, ids);
        Assert.DoesNotContain(uploaded.Id, ids);
    }

    [Fact]
    public async Task Bucket_offers_returns_the_offer_stages_only()
    {
        var inScope = new[] { "Offer Preparation", "Offer Extended", "Offer Accepted" }
            .Select(s => Data.AddCandidate(status: s).Id).ToList();
        var outOfScope = new[] { "Hired", "Offer Declined", "Recommended", "Uploaded", "Reject" }
            .Select(s => Data.AddCandidate(status: s).Id).ToList();

        var ids = await Ids(CandidateBuckets.Offers);

        Assert.All(inScope, id => Assert.Contains(id, ids));
        Assert.All(outOfScope, id => Assert.DoesNotContain(id, ids));
    }

    [Fact]
    public async Task The_hired_and_offers_buckets_respect_a_recruiters_scope()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var mine = Data.AddCandidate(ownerUserId: recruiter.Id, status: "Hired");
        var someoneElses = Data.AddCandidate(status: "Hired");

        var ids = await Ids(CandidateBuckets.Hired, recruiter.Id);

        Assert.Contains(mine.Id, ids);
        Assert.DoesNotContain(someoneElses.Id, ids);
    }
}

/// <summary>The batch filter over the real HTTP pipeline (#195): the controller never read the query parameter.</summary>
[Collection(ApiCollection.Name)]
public class CandidateListBatchApiTests(ApiFixture fx)
{
    private async Task<List<int>> ListIdsAsync(string query)
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var resp = await fx.SendAsync(HttpMethod.Get, $"/api/candidates?pageSize=100&{query}", token);
        resp.EnsureSuccessStatusCode();
        using var doc = System.Text.Json.JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToList();
    }

    [Fact]
    public async Task The_batch_filter_narrows_by_batch_name_and_by_batch_id()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var inBatch = await fx.NewCandidateAsync(fx.AdminId, batchId: $"id-{tag}", batchName: $"Batch {tag}");
        var otherBatch = await fx.NewCandidateAsync(fx.AdminId, batchId: "id-other", batchName: "Other batch");
        var noBatch = await fx.NewCandidateAsync(fx.AdminId);

        var byName = await ListIdsAsync($"batch=Batch%20{tag}");
        var byId = await ListIdsAsync($"batch=id-{tag}");

        Assert.Equal([inBatch], byName);
        Assert.Equal([inBatch], byId);
        Assert.DoesNotContain(otherBatch, byName);
        Assert.DoesNotContain(noBatch, byId);
    }

    [Fact]
    public async Task Without_a_batch_every_candidate_is_listed()
    {
        var a = await fx.NewCandidateAsync(fx.AdminId, batchId: "id-a", batchName: "A");
        var b = await fx.NewCandidateAsync(fx.AdminId);

        var ids = await ListIdsAsync("");

        Assert.Contains(a, ids);
        Assert.Contains(b, ids);
    }
}
