using System.Net;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>POST /api/candidate-drafts/estimate-experience: the review form's way to refresh Relevant Experience as roles change.</summary>
[Collection(ApiCollection.Name)]
public class DraftExperienceEstimateTests(ApiFixture fx)
{
    private async Task<string?> Estimate(params object[] experiences)
    {
        var token = await fx.LoginAsync(fx.RecruiterEmail);
        var resp = await fx.SendAsync(HttpMethod.Post, "/api/candidate-drafts/estimate-experience", token, new { experiences });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var value = doc.RootElement.GetProperty("relevantExperience");
        return value.ValueKind == JsonValueKind.Null ? null : value.GetString();
    }

    [Fact]
    public async Task Gaps_between_roles_are_left_out()
    {
        var bucket = await Estimate(
            new { duration = "Jan 2010 - Dec 2011" },
            new { duration = "Jan 2020 - Dec 2021" });

        Assert.Equal("3-5 Years", bucket);
    }

    [Fact]
    public async Task Structured_months_win_over_the_duration_text()
    {
        // The text says 21 years; the structured months say two 2-year roles. A reviewer who retypes the text
        // is expected to clear the months, so when both exist the months are the source of truth.
        var bucket = await Estimate(
            new { duration = "Jan 2000 - Dec 2020", startMonth = "2010-01", endMonth = "2011-12" },
            new { duration = "Jan 2000 - Dec 2020", startMonth = "2020-01", endMonth = "2021-12" });

        Assert.Equal("3-5 Years", bucket);
    }

    [Fact]
    public async Task Duration_text_is_read_when_there_are_no_structured_months()
    {
        Assert.Equal("2-3 Years", await Estimate(new { duration = "03/2012 - 05/2014" }));
    }

    [Fact]
    public async Task No_usable_dates_gives_null_so_the_reviewer_chooses()
    {
        Assert.Null(await Estimate());
        Assert.Null(await Estimate(new { duration = "recent" }, new { }));
    }
}
