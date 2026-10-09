using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The dashboard's change indicators: the weekly KPI deltas and the applications summary. Every
/// figure here is org-wide, so each test compares against a baseline taken before it adds rows
/// rather than asserting absolute counts on a shared database.
/// </summary>
public class DashboardServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static readonly TimeSpan Minute = TimeSpan.FromMinutes(1);

    private Candidate CreatedAt(DateTime createdAt)
    {
        var c = Data.AddCandidate();
        c.CreatedAt = createdAt;
        Db.SaveChanges();
        return c;
    }

    /// <summary>A candidate whose status history is exactly <paramref name="steps"/>, oldest first.</summary>
    private Candidate WithHistory(params (string Status, DateTime At)[] steps)
    {
        var c = Data.AddCandidate(
            status: steps[^1].Status,
            priorStatuses: steps[..^1].Select(s => s.Status).ToArray());
        var history = c.StatusHistories.ToList();
        for (var i = 0; i < steps.Length; i++) history[i].ChangedAt = steps[i].At;
        Db.SaveChanges();
        return c;
    }

    [Fact]
    public async Task New_prev_week_counts_only_the_seven_days_before_this_week()
    {
        var before = await Dashboard().GetKpisAsync();
        var now = DateTime.UtcNow;

        CreatedAt(now.AddDays(-7) + Minute);   // this week, just inside the boundary
        CreatedAt(now.AddDays(-7) - Minute);   // previous week, just past it
        CreatedAt(now.AddDays(-14) + Minute);  // previous week, at its far edge
        CreatedAt(now.AddDays(-14) - Minute);  // older than both windows

        var after = await Dashboard().GetKpisAsync();
        Assert.Equal(1, after.NewThisWeek - before.NewThisWeek);
        Assert.Equal(2, after.NewPrevWeek - before.NewPrevWeek);
    }

    [Fact]
    public async Task Recommended_this_week_counts_first_entry_into_the_bucket_only()
    {
        var before = await Dashboard().GetKpisAsync();
        var now = DateTime.UtcNow;

        // Arrived in the positive bucket this week: counts.
        WithHistory(("Uploaded", now.AddDays(-20)), ("Recommended", now.AddDays(-2)));
        // Recommended two weeks ago, moved to an offer this week: still in the bucket, not new to it.
        WithHistory(("Recommended", now.AddDays(-10)), ("Offer Extended", now.AddDays(-1)));
        // Entered the bucket before the window: does not count.
        WithHistory(("Uploaded", now.AddDays(-30)), ("Recommended", now.AddDays(-7) - Minute));

        var after = await Dashboard().GetKpisAsync();
        Assert.Equal(3, after.Recommended - before.Recommended);
        Assert.Equal(1, after.RecommendedThisWeek - before.RecommendedThisWeek);
    }

    [Fact]
    public async Task Rejected_this_week_ignores_candidates_who_have_left_the_bucket()
    {
        var before = await Dashboard().GetKpisAsync();
        var now = DateTime.UtcNow;

        WithHistory(("Uploaded", now.AddDays(-5)), ("Not Recommended", now.AddDays(-3)));
        WithHistory(("Uploaded", now.AddDays(-12)), ("Reject", now.AddDays(-9)));
        // Rejected this week but since reopened: no longer in the bucket, so not in its delta.
        WithHistory(("Reject", now.AddDays(-2)), ("Uploaded", now.AddDays(-1)));

        var after = await Dashboard().GetKpisAsync();
        Assert.Equal(2, after.Rejected - before.Rejected);
        Assert.Equal(1, after.RejectedThisWeek - before.RejectedThisWeek);
    }

    [Fact]
    public async Task Applications_summary_splits_the_current_and_previous_windows()
    {
        var before = await Dashboard().GetApplicationsSummaryAsync(7);
        var start = DateTime.UtcNow.Date.AddDays(-6);

        CreatedAt(start);                       // first moment of the current window
        CreatedAt(start - Minute);              // last minute of the previous window
        CreatedAt(start.AddDays(-7));           // first moment of the previous window
        CreatedAt(start.AddDays(-7) - Minute);  // before both

        var after = await Dashboard().GetApplicationsSummaryAsync(7);
        Assert.Equal(7, after.Days);
        Assert.Equal(1, after.Total - before.Total);
        Assert.Equal(2, after.PreviousTotal - before.PreviousTotal);
    }

    [Fact]
    public async Task Applications_summary_total_matches_the_trend_bars()
    {
        CreatedAt(DateTime.UtcNow);
        CreatedAt(DateTime.UtcNow.AddDays(-20));

        var summary = await Dashboard().GetApplicationsSummaryAsync(30);
        var trend = await Dashboard().GetApplicationsTrendAsync(30);
        Assert.Equal(trend.Sum(p => p.Count), summary.Total);
    }

    [Theory]
    [InlineData(7, 7)]
    [InlineData(90, 90)]
    [InlineData(45, 30)]
    [InlineData(0, 30)]
    public async Task Applications_summary_clamps_days_like_the_trend(int asked, int expected)
    {
        ApplicationsSummaryDto summary = await Dashboard().GetApplicationsSummaryAsync(asked);
        Assert.Equal(expected, summary.Days);
    }
}
