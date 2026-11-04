using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>AuditService: recording an event and querying (filter, date range, order, paging).</summary>
public class AuditServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private AuditService MakeAudit() =>
        new(Db, new CurrentUser(new HttpContextAccessor()), NullLogger<AuditService>.Instance);

    private void SeedLog(string action, string? entityType, int? entityId, DateTime timestamp, int? actorUserId = 1)
    {
        Db.AuditLogs.Add(new AuditLog
        {
            Action = action, EntityType = entityType, EntityId = entityId,
            Timestamp = timestamp, ActorUserId = actorUserId, ActorName = "Tester",
        });
        Db.SaveChanges();
    }

    [Fact]
    public async Task Record_writes_a_row_with_actor_and_fields()
    {
        await MakeAudit().RecordAsync("Candidate.Deleted", actorUserId: 7, actorName: "Alice",
            entityType: "Candidate", entityId: 44, summary: "Deleted candidate #44", details: "{\"x\":1}");

        var row = await Db.AuditLogs.SingleAsync(a => a.Action == "Candidate.Deleted");
        Assert.Equal(7, row.ActorUserId);
        Assert.Equal("Alice", row.ActorName);
        Assert.Equal("Candidate", row.EntityType);
        Assert.Equal(44, row.EntityId);
        Assert.Equal("Deleted candidate #44", row.Summary);
    }

    [Fact]
    public async Task Query_filters_by_entity_type_and_orders_newest_first()
    {
        var now = DateTime.UtcNow;
        SeedLog("Candidate.Created", "Candidate", 1, now.AddMinutes(-3));
        SeedLog("Role.Created", "Role", 2, now.AddMinutes(-2));
        SeedLog("Candidate.Deleted", "Candidate", 1, now.AddMinutes(-1)); // newest candidate event

        var result = await MakeAudit().QueryAsync(null, "Candidate", null, null, null, null, page: 1, pageSize: 50);

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, i => Assert.Equal("Candidate", i.EntityType));
        Assert.Equal("Candidate.Deleted", result.Items[0].Action); // newest first
    }

    [Fact]
    public async Task Query_honors_date_range_and_action_filter()
    {
        var now = DateTime.UtcNow;
        SeedLog("Auth.Login", "User", 1, now.AddDays(-10));
        SeedLog("Auth.LoginFailed", null, null, now.AddMinutes(-5));

        var recentFailures = await MakeAudit().QueryAsync(
            null, null, null, "Failed", from: now.AddDays(-1), to: null, page: 1, pageSize: 50);

        Assert.Single(recentFailures.Items);
        Assert.Equal("Auth.LoginFailed", recentFailures.Items[0].Action);
    }

    [Fact]
    public async Task Query_paginates()
    {
        var now = DateTime.UtcNow;
        for (var i = 0; i < 5; i++) SeedLog("Test.Event", "Thing", i, now.AddMinutes(-i));

        var pageOne = await MakeAudit().QueryAsync(null, "Thing", null, null, null, null, page: 1, pageSize: 2);
        var pageTwo = await MakeAudit().QueryAsync(null, "Thing", null, null, null, null, page: 2, pageSize: 2);

        Assert.Equal(5, pageOne.TotalCount);
        Assert.Equal(2, pageOne.Items.Count);
        Assert.Equal(2, pageTwo.Items.Count);
        Assert.NotEqual(pageOne.Items[0].Id, pageTwo.Items[0].Id);
    }
}
