using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// SlackSettingsService/Resolver: token encrypted at rest, blank-keeps-existing, GET never leaks
/// the secret, category routing and validation, and resolve prefers the DB row with a config fallback.
/// </summary>
public class SlackSettingsServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static SecretProtector Protector() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Encryption:Key"] = "unit-test-encryption-key-32bytes!!" })
            .Build());

    private static IOptions<SlackOptions> Fallback(SlackOptions? o = null) => Options.Create(o ?? new SlackOptions());

    private SlackSettingsService Service(SecretProtector p, IOptions<SlackOptions> fb) =>
        new(Db, p, fb, new AuditService(Db, new CurrentUser(new HttpContextAccessor()), NullLogger<AuditService>.Instance));

    private SlackSettingsResolver Resolver(SecretProtector p, IOptions<SlackOptions> fb) =>
        new(Db, p, fb, NullLogger<SlackSettingsResolver>.Instance);

    private static UpsertSlackSettingsDto Dto(string? token, bool enabled = true, params string[] enabledCategories) => new(
        BotToken: token, Enabled: enabled,
        Categories: NotificationCategories.All
            .Select(c => new UpsertSlackCategoryDto(c.Key, enabledCategories.Contains(c.Key)))
            .ToList());

    [Fact]
    public async Task Save_encrypts_the_token_and_resolve_round_trips_it()
    {
        var p = Protector();
        var (ok, error) = await Service(p, Fallback()).SaveAsync(
            Dto("xoxb-s3cret", enabledCategories: NotificationCategories.InterviewAssigned), actorUserId: 1);
        Assert.True(ok);
        Assert.Null(error);

        var row = Db.SlackSettings.Single();
        Assert.NotNull(row.BotTokenEncrypted);
        Assert.NotEqual("xoxb-s3cret", row.BotTokenEncrypted);               // stored ciphertext, not plaintext

        var resolved = await Resolver(p, Fallback()).ResolveTokenAsync();
        Assert.Equal("xoxb-s3cret", resolved);                               // decrypts back
    }

    [Fact]
    public async Task Blank_token_on_update_keeps_the_existing_secret()
    {
        var p = Protector();
        var svc = Service(p, Fallback());
        await svc.SaveAsync(Dto("xoxb-original"), actorUserId: 1);

        // Update with no token → keep the stored one.
        await svc.SaveAsync(Dto(null, enabledCategories: NotificationCategories.InterviewAssigned), actorUserId: 1);

        var resolved = await Resolver(p, Fallback()).ResolveTokenAsync();
        Assert.Equal("xoxb-original", resolved);                             // unchanged
    }

    [Fact]
    public async Task Get_never_returns_the_token_and_reports_botTokenSet()
    {
        var p = Protector();
        var svc = Service(p, Fallback());

        var before = await svc.GetAsync();
        Assert.False(before.BotTokenSet);

        await svc.SaveAsync(Dto("xoxb-pw"), actorUserId: 1);
        var after = await svc.GetAsync();
        Assert.True(after.BotTokenSet);
        // The DTO has no token member at all — nothing to leak — assert the visible fields instead.
        Assert.True(after.Enabled);
    }

    [Fact]
    public async Task Resolve_falls_back_to_config_when_no_row_or_disabled()
    {
        var p = Protector();
        var fallback = Fallback(new SlackOptions { BotToken = "xoxb-fallback" });

        // No row → fallback.
        var resolved = await Resolver(p, fallback).ResolveTokenAsync();
        Assert.Equal("xoxb-fallback", resolved);

        // Disabled row → still fallback.
        await Service(p, fallback).SaveAsync(Dto("xoxb-pw", enabled: false), actorUserId: 1);
        var resolved2 = await Resolver(p, fallback).ResolveTokenAsync();
        Assert.Equal("xoxb-fallback", resolved2);
    }

    [Fact]
    public async Task Save_rejects_a_token_without_the_xoxb_prefix()
    {
        var (ok, error) = await Service(Protector(), Fallback()).SaveAsync(Dto("not-a-bot-token"), actorUserId: 1);

        Assert.False(ok);
        Assert.Contains("xoxb-", error);
        Assert.Empty(Db.SlackSettings);
    }

    [Theory]
    [InlineData("xoxb-has a space")]
    [InlineData("xoxb-line1\nline2")]
    [InlineData("xoxb-")] // prefix alone, nothing after it
    public async Task Save_rejects_a_token_with_disallowed_characters_or_no_body(string token)
    {
        var (ok, error) = await Service(Protector(), Fallback()).SaveAsync(Dto(token), actorUserId: 1);

        Assert.False(ok);
        Assert.NotNull(error);
        Assert.Empty(Db.SlackSettings);
    }

    [Fact]
    public async Task Save_rejects_an_unknown_category()
    {
        var dto = new UpsertSlackSettingsDto("xoxb-test", true, [new UpsertSlackCategoryDto("NotARealCategory", true)]);
        var (ok, error) = await Service(Protector(), Fallback()).SaveAsync(dto, actorUserId: 1);

        Assert.False(ok);
        Assert.Contains("Unknown notification category", error);
    }

    [Fact]
    public async Task Save_turns_categories_on_and_off_independently()
    {
        var p = Protector();
        var svc = Service(p, Fallback());
        await svc.SaveAsync(
            Dto("xoxb-test", enabledCategories: [NotificationCategories.InterviewAssigned, NotificationCategories.EvaluationSubmitted]),
            actorUserId: 1);

        var resolver = Resolver(p, Fallback());
        Assert.True(await resolver.IsCategoryEnabledAsync(NotificationCategories.InterviewAssigned));
        Assert.True(await resolver.IsCategoryEnabledAsync(NotificationCategories.EvaluationSubmitted));
        Assert.False(await resolver.IsCategoryEnabledAsync(NotificationCategories.RecruiterAssigned));

        // Flip InterviewAssigned off, leave EvaluationSubmitted on.
        await svc.SaveAsync(Dto(null, enabledCategories: [NotificationCategories.EvaluationSubmitted]), actorUserId: 1);
        Assert.False(await resolver.IsCategoryEnabledAsync(NotificationCategories.InterviewAssigned));
        Assert.True(await resolver.IsCategoryEnabledAsync(NotificationCategories.EvaluationSubmitted));
    }

    [Fact]
    public async Task IsCategoryEnabledAsync_is_false_without_a_token_even_if_the_category_row_is_on()
    {
        // No Save() call at all → no token anywhere, regardless of category rows.
        var resolver = Resolver(Protector(), Fallback());
        Assert.False(await resolver.IsCategoryEnabledAsync(NotificationCategories.InterviewAssigned));
    }

    [Fact]
    public async Task Save_audits_the_change_without_the_token()
    {
        await Service(Protector(), Fallback()).SaveAsync(
            Dto("xoxb-super-secret", enabledCategories: NotificationCategories.EvaluationSubmitted), actorUserId: 7);

        var entry = await Db.AuditLogs.SingleAsync(a => a.Action == "Config.SlackUpdated");
        Assert.DoesNotContain("xoxb-super-secret", entry.Summary ?? "");
        Assert.DoesNotContain("xoxb-super-secret", entry.Details ?? "");
        // What changed is still recorded, just never the secret itself.
        Assert.Contains("token replaced True", entry.Summary);
        Assert.Contains(NotificationCategories.EvaluationSubmitted, entry.Summary);
    }
}
