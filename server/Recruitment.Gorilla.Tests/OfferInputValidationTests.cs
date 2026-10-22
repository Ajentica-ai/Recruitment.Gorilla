using System.Net;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Offer input is validated before anything is written (#197): overlong fields used to be a DbUpdateException
/// (500), and a negative bonus or an expiry in the past was stored and printed on the letter.
/// </summary>
public class OfferInputValidationTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static DateTime Today => DateTime.UtcNow.Date;

    private static CreateOfferDto Create(
        string? title = "Engineer", decimal salary = 100000, string? currency = "USD", decimal? bonus = null,
        string? equity = null, DateTime? start = null, DateTime? expiry = null, string? notes = null) =>
        new(title, salary, currency, bonus, equity, start, expiry, notes);

    private static UpdateOfferDto Update(CreateOfferDto d) =>
        new(d.JobTitle, d.BaseSalary, d.Currency, d.Bonus, d.Equity, d.StartDate, d.ExpirationDate, d.Notes);

    public static TheoryData<string, CreateOfferDto> InvalidInputs() => new()
    {
        { "currency too long", Create(currency: "USDOLLARS12") },
        { "currency too short", Create(currency: "US") },
        { "currency with digits", Create(currency: "U5D") },
        { "currency with spaces inside", Create(currency: "U D") },
        { "job title too long", Create(title: new string('t', 201)) },
        { "equity too long", Create(equity: new string('e', 201)) },
        { "notes too long", Create(notes: new string('n', 2001)) },
        { "negative bonus", Create(bonus: -1) },
        { "salary above the column", Create(salary: 1_000_000_000_001m) },
        { "bonus above the column", Create(bonus: 1_000_000_000_001m) },
        { "expiry yesterday", Create(expiry: Today.AddDays(-1)) },
        { "expiry before start", Create(start: Today.AddDays(30), expiry: Today.AddDays(10)) },
    };

    private async Task<(Candidate Candidate, User Admin)> RecommendedAsync()
    {
        var admin = Data.AddUser(Roles.Admin);
        return (Data.AddCandidate(ownerUserId: admin.Id, status: "Recommended"), admin);
    }

    [Theory]
    [MemberData(nameof(InvalidInputs))]
    public async Task Creating_with_invalid_input_is_refused_and_writes_nothing(string why, CreateOfferDto dto)
    {
        _ = why;
        var (candidate, admin) = await RecommendedAsync();

        await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().CreateOfferAsync(candidate.Id, dto, null, admin.Id, admin.Name));

        Assert.Empty(Db.Offers.Where(o => o.CandidateId == candidate.Id));
        Assert.Equal("Recommended", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
    }

    [Theory]
    [MemberData(nameof(InvalidInputs))]
    public async Task Updating_with_invalid_input_is_refused_and_the_draft_is_unchanged(string why, CreateOfferDto dto)
    {
        _ = why;
        var (candidate, admin) = await RecommendedAsync();
        var offer = await Offers().CreateOfferAsync(candidate.Id, Create(), null, admin.Id, admin.Name);

        await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().UpdateOfferAsync(offer!.Id, candidate.Id, Update(dto), null, admin.Id, admin.Name));

        var stored = Db.Offers.AsNoTracking().Single(o => o.Id == offer!.Id);
        Assert.Equal(100000, stored.BaseSalary);
        Assert.Equal("USD", stored.Currency);
        Assert.Equal("Engineer", stored.JobTitle);
    }

    [Fact]
    public async Task Input_at_the_limits_is_accepted_and_the_currency_is_normalised()
    {
        var (candidate, admin) = await RecommendedAsync();
        var dto = Create(
            title: new string('t', 200), salary: 1_000_000_000_000m, currency: " usd ", bonus: 0,
            equity: new string('e', 200), start: Today, expiry: Today, notes: new string('n', 2000));

        var offer = await Offers().CreateOfferAsync(candidate.Id, dto, null, admin.Id, admin.Name);

        Assert.Equal("USD", offer!.Currency);
        Assert.Equal(0, offer.Bonus);
        Assert.Equal(2000, offer.Notes!.Length);
    }

    [Fact]
    public async Task Surrounding_whitespace_does_not_count_against_the_limits()
    {
        var (candidate, admin) = await RecommendedAsync();
        var dto = Create(title: "  " + new string('t', 200) + "  ", notes: new string('n', 2000) + "   ");

        Assert.NotNull(await Offers().CreateOfferAsync(candidate.Id, dto, null, admin.Id, admin.Name));
    }

    [Fact]
    public async Task A_valid_edit_still_works()
    {
        var (candidate, admin) = await RecommendedAsync();
        var offer = await Offers().CreateOfferAsync(candidate.Id, Create(), null, admin.Id, admin.Name);

        var updated = await Offers().UpdateOfferAsync(
            offer!.Id, candidate.Id, Update(Create(salary: 120000, currency: "EUR", bonus: 5000, expiry: Today.AddDays(14))),
            null, admin.Id, admin.Name);

        Assert.Equal(120000, updated!.BaseSalary);
        Assert.Equal("EUR", updated.Currency);
    }
}

/// <summary>The same rules over the real HTTP pipeline: a 400 with the reason, never a 500.</summary>
[Collection(ApiCollection.Name)]
public class OfferInputValidationApiTests(ApiFixture fx)
{
    private async Task<(int CandidateId, string Token)> RecommendedAsync() =>
        (await fx.NewCandidateAsync(fx.AdminId, status: "Recommended"), await fx.LoginAsync(fx.AdminEmail));

    [Theory]
    [InlineData("currency", "USDOLLARS12", "Currency")]
    [InlineData("currency", "12", "Currency")]
    [InlineData("notes", "LONG2001", "Notes")]
    [InlineData("jobTitle", "LONG201", "title")]
    [InlineData("equity", "LONG201", "quity")]
    [InlineData("bonus", -5, "onus")]
    public async Task Creating_with_invalid_input_is_a_400_with_the_reason(string field, object value, string mention)
    {
        var (candidateId, token) = await RecommendedAsync();
        value = value switch
        {
            "LONG2001" => new string('n', 2001),
            "LONG201" => new string('x', 201),
            _ => value,
        };
        var body = new Dictionary<string, object> { ["baseSalary"] = 90000, [field] = value };

        var resp = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{candidateId}/offers", token, body);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains(mention, await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_expiry_in_the_past_or_before_the_start_is_a_400()
    {
        var (candidateId, token) = await RecommendedAsync();
        var url = $"/api/candidates/{candidateId}/offers";

        var past = await fx.SendAsync(HttpMethod.Post, url, token,
            new { baseSalary = 90000, expirationDate = DateTime.UtcNow.Date.AddDays(-2) });
        var inverted = await fx.SendAsync(HttpMethod.Post, url, token,
            new { baseSalary = 90000, startDate = DateTime.UtcNow.Date.AddDays(30), expirationDate = DateTime.UtcNow.Date.AddDays(10) });

        Assert.Equal(HttpStatusCode.BadRequest, past.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inverted.StatusCode);
    }

    [Fact]
    public async Task Updating_with_an_overlong_field_is_a_400_not_a_500()
    {
        var (candidateId, token) = await RecommendedAsync();
        var created = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{candidateId}/offers", token, new { baseSalary = 90000 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var offerId = System.Text.Json.JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetInt32();

        var resp = await fx.SendAsync(HttpMethod.Put, $"/api/candidates/{candidateId}/offers/{offerId}", token,
            new { baseSalary = 90000, notes = new string('n', 2001) });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task A_valid_offer_is_still_created()
    {
        var (candidateId, token) = await RecommendedAsync();

        var resp = await fx.SendAsync(HttpMethod.Post, $"/api/candidates/{candidateId}/offers", token,
            new { baseSalary = 90000, currency = "gbp", bonus = 0, expirationDate = DateTime.UtcNow.Date.AddDays(7) });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
    }
}
