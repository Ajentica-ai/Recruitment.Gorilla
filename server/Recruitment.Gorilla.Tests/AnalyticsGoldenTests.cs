using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Pins the analytics numbers for a fixed dataset (#200). The service was refactored to filter in SQL instead of
/// loading every candidate, which must not change a single figure, so the summary is compared with output captured
/// from the in-memory implementation. All dates are fixed and every candidate ends in a terminal status, so nothing
/// depends on the clock. To recapture (only after an intended change to the numbers), run once with the environment
/// variable <c>ANALYTICS_GOLDEN_DUMP=1</c>.
/// </summary>
public class AnalyticsGoldenTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static readonly DateTime From = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc);
    private static DateTime D(int month, int day) => new(2026, month, day, 9, 0, 0, DateTimeKind.Utc);
    private static DateTime Jan(int day) => new(2026, 1, day, 9, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(User R1, User R2);

    private Seeded Seed()
    {
        var r1 = Data.AddUser(Roles.Recruiter, name: "Rita Recruiter");
        var r2 = Data.AddUser(Roles.Recruiter, name: "Ravi Recruiter");
        Data.AddUser(Roles.Admin, name: "Ada Admin");
        Data.AddUser(Roles.Recruiter, active: false, name: "Gone Recruiter");
        var panelist = Data.AddUser(Roles.Interviewer, name: "Pia Panelist");
        var sources = Db.CandidateSourceOptions.OrderBy(s => s.Id).Take(2).ToList();

        Candidate Make(string name, User? owner, int? sourceId, string status, DateTime created,
            params (string Status, DateTime At, string By)[] history)
        {
            var c = new Candidate
            {
                FullName = name, Email = $"{name.Replace(' ', '.')}@golden.local", RelevantExperience = "3",
                OwnerUserId = owner?.Id, SourceOptionId = sourceId, CurrentStatus = status, CreatedAt = created,
                StatusHistories = history.Select(h => new StatusHistory { Status = h.Status, ChangedAt = h.At, ChangedBy = h.By }).ToList(),
            };
            Db.Candidates.Add(c);
            Db.SaveChanges();
            return c;
        }

        var c1 = Make("Hired In June", r1, sources[0].Id, "Hired", D(6, 3),
            ("Uploaded", D(6, 3), "system"), ("Technical Assessment", D(6, 5), r1.Name), ("Interview Scheduled", D(6, 10), r1.Name),
            ("Offer Extended", D(6, 14), r1.Name), ("Hired", D(6, 18), r1.Name));
        Make("Rejected In June", r1, sources[0].Id, "Reject", D(6, 5),
            ("Uploaded", D(6, 5), "system"), ("Technical Assessment", D(6, 8), r1.Name), ("Reject", D(6, 12), r1.Name));
        var c3 = Make("Recommended In June", r2, sources[1].Id, "Recommended", D(6, 7),
            ("Uploaded", D(6, 7), "system"), ("Interview Scheduled", D(6, 11), r2.Name), ("Interview Completed", D(6, 15), r2.Name),
            ("Recommended", D(6, 20), r2.Name));
        Make("Hired In May", r2, null, "Hired", D(5, 10),
            ("Uploaded", D(5, 10), "system"), ("Call for Interview", D(5, 14), r2.Name), ("Hired", D(5, 25), r2.Name));
        Make("Rejected In May", r1, sources[1].Id, "Reject", D(5, 12),
            ("Uploaded", D(5, 12), "system"), ("Reject", D(5, 20), r1.Name));
        Make("Old And Rejected", r1, sources[0].Id, "Reject", Jan(5),
            ("Uploaded", Jan(5), "system"), ("Reject", Jan(9), r1.Name));
        Make("Old And Still Open", r2, sources[1].Id, "Interview Scheduled", Jan(10),
            ("Uploaded", Jan(10), "system"), ("Interview Scheduled", Jan(14), r2.Name));
        Make("Created Early Hired In June", r1, sources[0].Id, "Hired", new DateTime(2026, 4, 1, 9, 0, 0, DateTimeKind.Utc),
            ("Uploaded", new DateTime(2026, 4, 1, 9, 0, 0, DateTimeKind.Utc), "system"),
            ("Interview Scheduled", new DateTime(2026, 4, 5, 9, 0, 0, DateTimeKind.Utc), r1.Name), ("Hired", D(6, 25), r1.Name));
        Make("Unowned And Old", null, null, "Reject", Jan(20),
            ("Uploaded", Jan(20), "system"), ("Reject", Jan(25), "system"));

        // Interviewer participation: counted by when the interview row was created.
        void Interview(Candidate c, DateTime created, params User[] who)
        {
            var i = Data.AddInterview(c.Id, who.Select(u => u.Id).ToArray());
            i.CreatedAt = created;
            Db.SaveChanges();
        }
        Interview(c1, D(6, 9), r1, panelist);
        Interview(c1, D(6, 12), r1);
        Interview(c3, D(6, 10), r2, panelist);
        Interview(c3, D(2, 1), r1); // outside the period

        return new Seeded(r1, r2);
    }

    /// <summary>The summary with user ids replaced by names, so the result does not depend on identity values.</summary>
    private static string Canonical(RecruitingAnalyticsSummaryDto s)
    {
        var json = JsonSerializer.SerializeToNode(s)!.AsObject();
        json.Remove("RecruiterWorkloads");
        json["RecruiterWorkloads"] = JsonSerializer.SerializeToNode(
            s.RecruiterWorkloads.OrderBy(r => r.RecruiterName).Select(r => new
            {
                r.RecruiterName, r.ActiveCandidates, r.TotalAssigned, r.TransitionsLogged, r.InterviewsParticipated, r.HiresMade,
            }));
        return json.ToJsonString(new JsonSerializerOptions { WriteIndented = true })
            .Replace("\r\n", "\n");
    }

    private static string GoldenPath(string name, string callerFile) =>
        Path.Combine(Path.GetDirectoryName(callerFile)!, "AnalyticsGolden", name);

    private static void Check(string actual, string name, [CallerFilePath] string callerFile = "")
    {
        var path = GoldenPath(name, callerFile);
        if (Environment.GetEnvironmentVariable("ANALYTICS_GOLDEN_DUMP") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, actual);
            return;
        }
        Assert.Equal(File.ReadAllText(path).Replace("\r\n", "\n"), actual);
    }

    [Fact]
    public async Task The_unscoped_summary_matches_the_pinned_numbers()
    {
        Seed();

        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery(From: From, To: To));

        Check(Canonical(summary), "unscoped.json");
    }

    [Fact]
    public async Task A_recruiters_scoped_summary_matches_the_pinned_numbers()
    {
        var seeded = Seed();

        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery(From: From, To: To), seeded.R1.Id);

        Check(Canonical(summary), "scoped-recruiter.json");
    }
}

/// <summary>Analytics loads only the candidates that matter to the period (#200), and still counts the rest.</summary>
public class AnalyticsWindowTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static readonly DateTime Start = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc);

    private void SeedOld(int count, User owner)
    {
        // Created and last touched long before the window, so none of them belongs in it.
        var long_ago = new DateTime(2025, 1, 10, 9, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < count; i++)
        {
            Db.Candidates.Add(new Candidate
            {
                FullName = $"Old {i}", Email = $"old.{i}.{Guid.NewGuid():N}@window.local", RelevantExperience = "1",
                OwnerUserId = owner.Id, CurrentStatus = i % 2 == 0 ? "Reject" : "Interview Scheduled", CreatedAt = long_ago,
                StatusHistories = [new StatusHistory { Status = "Uploaded", ChangedAt = long_ago, ChangedBy = "system" }],
            });
        }
        Db.SaveChanges();
    }

    [Fact]
    public async Task The_window_query_returns_only_candidates_created_or_changed_in_it_however_many_old_ones_exist()
    {
        var owner = Data.AddUser(Roles.Recruiter);
        SeedOld(3000, owner);
        var created = Data.AddCandidate(ownerUserId: owner.Id);
        created.CreatedAt = new DateTime(2026, 6, 10, 9, 0, 0, DateTimeKind.Utc);
        var changed = Data.AddCandidate(ownerUserId: owner.Id);
        changed.CreatedAt = new DateTime(2025, 2, 1, 9, 0, 0, DateTimeKind.Utc);
        Db.StatusHistories.Add(new StatusHistory { CandidateId = changed.Id, Status = "Hired", ChangedAt = new DateTime(2026, 6, 20, 9, 0, 0, DateTimeKind.Utc), ChangedBy = "x" });
        var inPreviousPeriod = Data.AddCandidate(ownerUserId: owner.Id);
        inPreviousPeriod.CreatedAt = new DateTime(2026, 5, 15, 9, 0, 0, DateTimeKind.Utc);
        Db.SaveChanges();

        var scoped = Analytics().ScopedCandidates(new AnalyticsFilterQuery(From: Start, To: End), null, null);
        var loaded = await AnalyticsService.WindowCandidates(scoped, Start.AddDays(-30), End).ToListAsync();

        Assert.Equal(
            new[] { created.Id, changed.Id, inPreviousPeriod.Id }.Order(),
            loaded.Select(c => c.Id).Order());
        Assert.All(loaded, c => Assert.NotEmpty(c.StatusHistories)); // the full trail comes with each one
    }

    [Fact]
    public async Task Workload_totals_still_count_the_old_candidates_a_recruiter_owns()
    {
        var owner = Data.AddUser(Roles.Recruiter, name: "Owner With Many");
        SeedOld(40, owner); // 20 Reject (closed) and 20 Interview Scheduled (active), all outside the window

        var summary = await Analytics().GetSummaryAsync(new AnalyticsFilterQuery(From: Start, To: End));

        var row = summary.RecruiterWorkloads.Single(r => r.RecruiterUserId == owner.Id);
        Assert.Equal(40, row.TotalAssigned);
        Assert.Equal(20, row.ActiveCandidates);
        Assert.Equal(0, summary.TotalCandidatesInPeriod); // none of them is in the period itself
    }
}
