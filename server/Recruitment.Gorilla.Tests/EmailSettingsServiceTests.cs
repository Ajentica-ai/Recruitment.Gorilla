using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EmailSettingsService/Resolver: a secret is encrypted at rest, blank keeps the existing one, GET
/// never leaks a secret, resolve prefers the DB row with a config fallback, and the two providers
/// (Smtp, HttpApi) don't interfere with each other's stored settings.
/// </summary>
public class EmailSettingsServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static SecretProtector Protector() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Encryption:Key"] = "unit-test-encryption-key-32bytes!!" })
            .Build());

    private static IOptions<SmtpOptions> SmtpFallback(SmtpOptions? o = null) => Options.Create(o ?? new SmtpOptions());
    private static IOptions<EmailApiOptions> ApiFallback(EmailApiOptions? o = null) => Options.Create(o ?? new EmailApiOptions());
    private static IOptions<EmailProviderOptions> ProviderFallback(string provider = EmailProviders.Smtp) =>
        Options.Create(new EmailProviderOptions { Provider = provider });

    private EmailSettingsService Service(SecretProtector p, IOptions<SmtpOptions>? smtpFb = null, IOptions<EmailApiOptions>? apiFb = null) =>
        new(Db, p, smtpFb ?? SmtpFallback(), apiFb ?? ApiFallback(),
            new AuditService(Db, new CurrentUser(new HttpContextAccessor()), NullLogger<AuditService>.Instance));

    private EmailSettingsResolver Resolver(
        SecretProtector p, IOptions<SmtpOptions>? smtpFb = null, IOptions<EmailApiOptions>? apiFb = null, IOptions<EmailProviderOptions>? providerFb = null) =>
        new(Db, p, smtpFb ?? SmtpFallback(), apiFb ?? ApiFallback(), providerFb ?? ProviderFallback(), NullLogger<EmailSettingsResolver>.Instance);

    private static UpsertEmailSettingsDto SmtpDto(string? password) => new(
        Provider: EmailProviders.Smtp, Host: "smtp.example.com", Port: 587, User: "user@example.com", Password: password,
        FromAddress: "from@example.com", FromName: "RG", UseStartTls: true,
        ApiBaseUrl: null, ApiKey: null, AllowedRecipientDomains: null, Enabled: true);

    private static UpsertEmailSettingsDto ApiDto(string? apiKey, string baseUrl = "https://notify.example.com") => new(
        Provider: EmailProviders.HttpApi, Host: "", Port: 587, User: null, Password: null,
        FromAddress: "from@example.com", FromName: "RG", UseStartTls: true,
        ApiBaseUrl: baseUrl, ApiKey: apiKey, AllowedRecipientDomains: "example.com", Enabled: true);

    [Fact]
    public async Task Save_encrypts_the_smtp_password_and_resolve_round_trips_it()
    {
        var p = Protector();
        await Service(p).SaveAsync(SmtpDto("s3cret-app-pw"), actorUserId: 1);

        var row = Db.EmailSettings.Single();
        Assert.NotNull(row.PasswordEncrypted);
        Assert.NotEqual("s3cret-app-pw", row.PasswordEncrypted); // stored ciphertext, not plaintext

        var resolved = await Resolver(p).ResolveAsync();
        Assert.Equal(EmailProviders.Smtp, resolved.Provider);
        Assert.Equal("s3cret-app-pw", resolved.Smtp.Password); // decrypts back
        Assert.Equal("smtp.example.com", resolved.Smtp.Host);
    }

    [Fact]
    public async Task Blank_smtp_password_on_update_keeps_the_existing_secret()
    {
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(SmtpDto("original-pw"), actorUserId: 1);

        // Update host/port only, password blank → keep the stored one.
        await svc.SaveAsync(SmtpDto(null) with { Host = "smtp.new.com" }, actorUserId: 1);

        var resolved = await Resolver(p).ResolveAsync();
        Assert.Equal("smtp.new.com", resolved.Smtp.Host);
        Assert.Equal("original-pw", resolved.Smtp.Password); // unchanged
    }

    [Fact]
    public async Task Get_never_returns_a_secret_and_reports_passwordSet()
    {
        var p = Protector();
        var svc = Service(p);

        var before = await svc.GetAsync();
        Assert.False(before.PasswordSet);
        Assert.False(before.ApiKeySet);

        await svc.SaveAsync(SmtpDto("pw"), actorUserId: 1);
        var after = await svc.GetAsync();
        Assert.True(after.PasswordSet);
        // The DTO has no password/apiKey member at all — nothing to leak — assert the visible fields instead.
        Assert.Equal("smtp.example.com", after.Host);
        Assert.True(after.Enabled);
    }

    [Fact]
    public async Task Resolve_falls_back_to_config_when_no_row_or_disabled()
    {
        var p = Protector();
        var smtpFb = SmtpFallback(new SmtpOptions { Host = "fallback.smtp", FromAddress = "cfg@x.com" });

        // No row → fallback.
        var resolved = await Resolver(p, smtpFb).ResolveAsync();
        Assert.Equal("fallback.smtp", resolved.Smtp.Host);

        // Disabled row → still fallback.
        await Service(p, smtpFb).SaveAsync(SmtpDto("pw") with { Enabled = false }, actorUserId: 1);
        var resolved2 = await Resolver(p, smtpFb).ResolveAsync();
        Assert.Equal("fallback.smtp", resolved2.Smtp.Host);
    }

    [Fact]
    public async Task Save_encrypts_the_api_key_and_resolve_round_trips_it()
    {
        var p = Protector();
        await Service(p).SaveAsync(ApiDto("secret-api-key"), actorUserId: 1);

        var row = Db.EmailSettings.Single();
        Assert.Equal(EmailProviders.HttpApi, row.Provider);
        Assert.NotNull(row.ApiKeyEncrypted);
        Assert.NotEqual("secret-api-key", row.ApiKeyEncrypted);

        var resolved = await Resolver(p).ResolveAsync();
        Assert.Equal(EmailProviders.HttpApi, resolved.Provider);
        Assert.Equal("secret-api-key", resolved.Api.ApiKey);
        Assert.Equal("https://notify.example.com", resolved.Api.BaseUrl);
        Assert.Equal("example.com", resolved.Api.AllowedRecipientDomains);
    }

    [Fact]
    public async Task Blank_api_key_on_update_keeps_the_existing_secret()
    {
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key"), actorUserId: 1);

        await svc.SaveAsync(ApiDto(null) with { AllowedRecipientDomains = "new.example.com" }, actorUserId: 1);

        var resolved = await Resolver(p).ResolveAsync();
        Assert.Equal("original-key", resolved.Api.ApiKey);
        Assert.Equal("new.example.com", resolved.Api.AllowedRecipientDomains);
    }

    [Fact]
    public async Task Changing_the_api_base_urls_host_without_a_new_key_is_rejected()
    {
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key", "https://notify.example.com"), actorUserId: 1);

        var (ok, error) = await svc.SaveAsync(ApiDto(null, "https://evil.example.org"), actorUserId: 1);

        Assert.False(ok);
        Assert.NotNull(error);
        // The stored row (and its key) must be untouched by the rejected save.
        var row = Db.EmailSettings.Single();
        Assert.Equal("https://notify.example.com", row.ApiBaseUrl);
    }

    [Fact]
    public async Task Changing_the_api_base_url_with_a_new_key_is_allowed()
    {
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key", "https://notify.example.com"), actorUserId: 1);

        var (ok, error) = await svc.SaveAsync(ApiDto("new-key", "https://evil.example.org"), actorUserId: 1);

        Assert.True(ok);
        Assert.Null(error);
        var resolved = await Resolver(p).ResolveAsync();
        Assert.Equal("https://evil.example.org", resolved.Api.BaseUrl);
        Assert.Equal("new-key", resolved.Api.ApiKey);
    }

    [Fact]
    public async Task Resolve_falls_back_to_the_configured_provider_when_no_row_exists()
    {
        var p = Protector();
        var resolved = await Resolver(p, providerFb: ProviderFallback(EmailProviders.HttpApi)).ResolveAsync();
        Assert.Equal(EmailProviders.HttpApi, resolved.Provider);
    }

    [Fact]
    public async Task Save_never_records_a_secret_in_the_audit_trail()
    {
        var p = Protector();
        await Service(p).SaveAsync(SmtpDto("s3cret-app-pw"), actorUserId: 1);
        await Service(p).SaveAsync(ApiDto("secret-api-key"), actorUserId: 1);

        var entry = await Audit().QueryAsync(null, "EmailSetting", null, null, null, null, 1, 10);
        Assert.All(entry.Items, e =>
        {
            Assert.DoesNotContain("s3cret-app-pw", e.Summary);
            Assert.DoesNotContain("secret-api-key", e.Summary);
        });
    }

    [Fact]
    public async Task A_save_as_Smtp_cannot_be_used_to_plant_a_new_api_host_without_the_key()
    {
        // Regression: the host-change check used to run only when the save itself was for the HttpApi
        // provider, so a save made while Smtp is selected could silently change the stored ApiBaseUrl
        // (a shared column) without ever being asked for the key — and a later HttpApi save would then
        // see the planted URL as "unchanged" and skip the check entirely.
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key", "https://notify.example.com"), actorUserId: 1);

        var (planted, plantedError) = await svc.SaveAsync(SmtpDto("pw") with { ApiBaseUrl = "https://evil.example.org" }, actorUserId: 1);

        Assert.False(planted);
        Assert.NotNull(plantedError);
        Assert.Equal("https://notify.example.com", Db.EmailSettings.Single().ApiBaseUrl);
    }

    [Fact]
    public async Task Clearing_a_stored_api_base_url_without_the_key_is_also_rejected()
    {
        // The host-change check must also catch "stored URL present, new URL blank": otherwise a save
        // that clears ApiBaseUrl (with the key left untouched) would make a later save accept any URL
        // at all as "unchanged from blank".
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key", "https://notify.example.com"), actorUserId: 1);

        var (ok, error) = await svc.SaveAsync(ApiDto(null, baseUrl: ""), actorUserId: 1);

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task A_base_url_differing_only_by_port_is_treated_as_a_different_host()
    {
        var p = Protector();
        var svc = Service(p);
        await svc.SaveAsync(ApiDto("original-key", "https://notify.example.com"), actorUserId: 1);

        var (ok, error) = await svc.SaveAsync(ApiDto(null, "https://notify.example.com:8443"), actorUserId: 1);

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Theory]
    [InlineData("ftp://notify.example.com")]        // not https
    [InlineData("notify.example.com")]               // not absolute
    [InlineData("https://user:pw@notify.example.com")] // embedded credentials
    [InlineData("https://notify.example.com/?x=1")]  // query string
    [InlineData("https://notify.example.com/#frag")] // fragment
    public async Task Save_rejects_a_malformed_api_base_url(string badUrl)
    {
        var (ok, error) = await Service(Protector()).SaveAsync(ApiDto("key", badUrl), actorUserId: 1);

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task An_unrecognised_provider_value_is_treated_as_smtp_rather_than_crash()
    {
        var (ok, _) = await Service(Protector()).SaveAsync(SmtpDto("pw") with { Provider = "CarrierPigeon" }, actorUserId: 1);

        Assert.True(ok);
        Assert.Equal(EmailProviders.Smtp, Db.EmailSettings.Single().Provider);
    }
}
