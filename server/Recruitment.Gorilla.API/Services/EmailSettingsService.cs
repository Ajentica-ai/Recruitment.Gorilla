using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>Resolves the effective email delivery settings at send time (behind an interface so tests can fake it).</summary>
public interface IEmailSettingsResolver
{
    Task<EmailDeliveryOptions> ResolveAsync();
}

/// <summary>
/// Produces the effective <see cref="EmailDeliveryOptions"/> used at send time: the in-app DB row
/// when it exists and is enabled (secrets decrypted), otherwise config (the <c>Smtp</c> section, or
/// <c>EmailApi</c> for the HTTP provider, picked by <c>Email:Provider</c>). Kept separate from
/// <see cref="EmailSettingsService"/> so <see cref="EmailService"/> has a minimal dependency (no
/// audit) and there's no risk of a dependency cycle.
/// </summary>
public class EmailSettingsResolver(
    AppDbContext db, SecretProtector protector,
    IOptions<SmtpOptions> smtpFallback, IOptions<EmailApiOptions> apiFallback, IOptions<EmailProviderOptions> providerFallback,
    ILogger<EmailSettingsResolver> logger)
    : IEmailSettingsResolver
{
    public const int RowId = 1;

    public async Task<EmailDeliveryOptions> ResolveAsync()
    {
        var row = await db.EmailSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == RowId);
        if (row is null || !row.Enabled)
            return ConfigFallback();

        return row.Provider == EmailProviders.HttpApi
            ? ResolveApi(row)
            : ResolveSmtp(row);
    }

    private EmailDeliveryOptions ResolveSmtp(EmailSetting row)
    {
        if (string.IsNullOrWhiteSpace(row.Host) || string.IsNullOrWhiteSpace(row.FromAddress))
            return ConfigFallback();

        string? password = null;
        if (!string.IsNullOrEmpty(row.PasswordEncrypted))
        {
            try
            {
                password = protector.Unprotect(row.PasswordEncrypted);
            }
            catch (Exception ex)
            {
                // Undecryptable (e.g. Encryption:Key changed) → fall back rather than send with no auth.
                logger.LogWarning(ex, "Could not decrypt the stored SMTP password; falling back to Smtp config.");
                return ConfigFallback();
            }
        }

        return new EmailDeliveryOptions
        {
            Provider = EmailProviders.Smtp,
            Smtp = new SmtpOptions
            {
                Host = row.Host,
                Port = row.Port,
                User = row.User,
                Password = password,
                FromAddress = row.FromAddress,
                FromName = row.FromName,
                UseStartTls = row.UseStartTls,
            },
        };
    }

    private EmailDeliveryOptions ResolveApi(EmailSetting row)
    {
        if (string.IsNullOrWhiteSpace(row.ApiBaseUrl))
            return ConfigFallback();

        string? apiKey = null;
        if (!string.IsNullOrEmpty(row.ApiKeyEncrypted))
        {
            try
            {
                apiKey = protector.Unprotect(row.ApiKeyEncrypted);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not decrypt the stored Notification API key; falling back to EmailApi config.");
                return ConfigFallback();
            }
        }

        return new EmailDeliveryOptions
        {
            Provider = EmailProviders.HttpApi,
            Api = new EmailApiOptions
            {
                BaseUrl = row.ApiBaseUrl,
                ApiKey = apiKey,
                FromName = row.FromName,
                AllowedRecipientDomains = string.IsNullOrWhiteSpace(row.AllowedRecipientDomains)
                    ? apiFallback.Value.AllowedRecipientDomains : row.AllowedRecipientDomains,
                TimeoutSeconds = apiFallback.Value.TimeoutSeconds,
                SupportsAttachments = apiFallback.Value.SupportsAttachments,
            },
        };
    }

    private EmailDeliveryOptions ConfigFallback()
    {
        var provider = string.IsNullOrWhiteSpace(providerFallback.Value.Provider)
            ? EmailProviders.Smtp : providerFallback.Value.Provider;
        return new EmailDeliveryOptions { Provider = provider, Smtp = smtpFallback.Value, Api = apiFallback.Value };
    }
}

/// <summary>
/// Admin control-panel CRUD for the email delivery settings (SuperAdmin) — one active provider at a
/// time. Reads never expose a secret; writes encrypt the active provider's secret via
/// <see cref="SecretProtector"/> and only replace it when a new one is given.
/// </summary>
public class EmailSettingsService(
    AppDbContext db, SecretProtector protector,
    IOptions<SmtpOptions> smtpFallback, IOptions<EmailApiOptions> apiFallback,
    AuditService audit)
{
    public async Task<EmailSettingsDto> GetAsync()
    {
        var row = await db.EmailSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == EmailSettingsResolver.RowId);
        if (row is null)
        {
            // No row yet — seed the form from the config fallback (non-secret fields only).
            var smtp = smtpFallback.Value;
            var api = apiFallback.Value;
            return new EmailSettingsDto(
                EmailProviders.Smtp, smtp.Host, smtp.Port, smtp.User, smtp.FromAddress, smtp.FromName, smtp.UseStartTls,
                api.BaseUrl, api.AllowedRecipientDomains,
                Enabled: false, PasswordSet: false, ApiKeySet: false, UpdatedAt: null);
        }

        return new EmailSettingsDto(
            row.Provider, row.Host, row.Port, row.User, row.FromAddress, row.FromName, row.UseStartTls,
            row.ApiBaseUrl ?? apiFallback.Value.BaseUrl,
            string.IsNullOrWhiteSpace(row.AllowedRecipientDomains) ? apiFallback.Value.AllowedRecipientDomains : row.AllowedRecipientDomains,
            row.Enabled, PasswordSet: !string.IsNullOrEmpty(row.PasswordEncrypted),
            ApiKeySet: !string.IsNullOrEmpty(row.ApiKeyEncrypted), row.UpdatedAt);
    }

    public async Task<(bool Ok, string? Error)> SaveAsync(UpsertEmailSettingsDto dto, int? actorUserId)
    {
        var provider = dto.Provider == EmailProviders.HttpApi ? EmailProviders.HttpApi : EmailProviders.Smtp;
        var newApiBaseUrl = dto.ApiBaseUrl?.Trim();

        // Validated unconditionally, not only when Provider is HttpApi: ApiBaseUrl/ApiKeyEncrypted are
        // shared state on the one row, so a save made while Provider is Smtp could otherwise plant an
        // unvalidated URL for a later HttpApi save to pick up untouched.
        if (!string.IsNullOrWhiteSpace(newApiBaseUrl) &&
            (!Uri.TryCreate(newApiBaseUrl, UriKind.Absolute, out var parsedUrl) || parsedUrl.Scheme != Uri.UriSchemeHttps
             || !string.IsNullOrEmpty(parsedUrl.UserInfo) || parsedUrl.Query.Length > 0 || parsedUrl.Fragment.Length > 0))
        {
            return (false, "The Notification API base URL must be a plain absolute https:// address (no credentials, query, or fragment).");
        }

        var row = await db.EmailSettings.FirstOrDefaultAsync(s => s.Id == EmailSettingsResolver.RowId);
        if (row is null)
        {
            row = new EmailSetting { Id = EmailSettingsResolver.RowId };
            db.EmailSettings.Add(row);
        }

        // Changing the base URL's origin (scheme+host+port) without also supplying a new key would
        // otherwise send a key that was only ever approved for the old origin to wherever this field
        // gets changed to next. Checked whenever a key is already stored, regardless of which provider
        // this particular save is for: a Smtp-provider save that quietly changes ApiBaseUrl, followed
        // by a later HttpApi save that just matches whatever got planted, must not be a way around this.
        if (!string.IsNullOrEmpty(row.ApiKeyEncrypted) && string.IsNullOrWhiteSpace(dto.ApiKey)
            && !OriginsMatch(row.ApiBaseUrl, newApiBaseUrl))
        {
            return (false, "The Notification API base URL changed. Enter the API key again to confirm sending it to the new host.");
        }

        row.Provider = provider;
        row.Host = dto.Host.Trim();
        row.Port = dto.Port;
        row.User = string.IsNullOrWhiteSpace(dto.User) ? null : dto.User.Trim();
        row.FromAddress = dto.FromAddress.Trim();
        row.FromName = string.IsNullOrWhiteSpace(dto.FromName) ? "Recruitment Gorilla" : dto.FromName.Trim();
        row.UseStartTls = dto.UseStartTls;
        row.ApiBaseUrl = string.IsNullOrWhiteSpace(newApiBaseUrl) ? null : newApiBaseUrl;
        row.AllowedRecipientDomains = string.IsNullOrWhiteSpace(dto.AllowedRecipientDomains) ? null : dto.AllowedRecipientDomains.Trim();
        row.Enabled = dto.Enabled;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByUserId = actorUserId;

        // Only replace a secret when a new one is supplied; blank keeps the existing one.
        var passwordReplaced = !string.IsNullOrWhiteSpace(dto.Password);
        if (passwordReplaced)
            row.PasswordEncrypted = protector.Protect(dto.Password!.Trim());

        var apiKeyReplaced = !string.IsNullOrWhiteSpace(dto.ApiKey);
        if (apiKeyReplaced)
            row.ApiKeyEncrypted = protector.Protect(dto.ApiKey!.Trim());

        await db.SaveChangesAsync();

        // Never record either secret in the audit trail.
        var baseUrlOrigin = TryGetOrigin(row.ApiBaseUrl);
        await audit.RecordAsync("Config.EmailUpdated", "EmailSetting", row.Id,
            $"Updated email settings (provider {row.Provider}, enabled {row.Enabled}, " +
            $"password replaced {passwordReplaced}, api key replaced {apiKeyReplaced}" +
            (baseUrlOrigin is null ? "" : $", api host '{baseUrlOrigin}'") + ")");

        return (true, null);
    }

    /// <summary>
    /// True when both URLs resolve to the same origin (scheme + host + port), or neither resolves to
    /// one at all (e.g. both blank). Comparing the full origin, not just the host, means
    /// <c>https://legit</c> and <c>https://legit:8443</c> count as different, since a key approved for
    /// one is not necessarily safe to send to the other.
    /// </summary>
    private static bool OriginsMatch(string? a, string? b) =>
        string.Equals(TryGetOrigin(a), TryGetOrigin(b), StringComparison.OrdinalIgnoreCase);

    private static string? TryGetOrigin(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.GetLeftPart(UriPartial.Authority) : null;
}

/// <summary>Which provider is active when no in-app row overrides it. Bound from the "Email" config section.</summary>
public class EmailProviderOptions
{
    public string Provider { get; set; } = EmailProviders.Smtp;
}
