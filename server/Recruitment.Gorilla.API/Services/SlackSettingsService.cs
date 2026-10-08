using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>Resolves the effective Slack options at send time (behind an interface so tests can fake it).</summary>
public interface ISlackSettingsResolver
{
    /// <summary>The bot token to use, or null when Slack isn't configured anywhere.</summary>
    Task<string?> ResolveTokenAsync();

    /// <summary>True only when a token resolves AND the given category is routed to Slack.</summary>
    Task<bool> IsCategoryEnabledAsync(string category);
}

/// <summary>
/// Produces the effective Slack bot token used at send time: the in-app DB row when it exists and
/// is enabled (decrypted), otherwise the <c>Slack:BotToken</c> config fallback. Kept separate from
/// <see cref="SlackSettingsService"/> so <see cref="SlackService"/> has a minimal dependency (no
/// audit) and there's no risk of a dependency cycle.
/// </summary>
public class SlackSettingsResolver(
    AppDbContext db, SecretProtector protector, IOptions<SlackOptions> fallback, ILogger<SlackSettingsResolver> logger)
    : ISlackSettingsResolver
{
    public const int RowId = 1;

    public async Task<string?> ResolveTokenAsync()
    {
        var row = await db.SlackSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == RowId);
        if (row is not null && row.Enabled && !string.IsNullOrEmpty(row.BotTokenEncrypted))
        {
            try
            {
                return protector.Unprotect(row.BotTokenEncrypted);
            }
            catch (Exception ex)
            {
                // Undecryptable (e.g. Encryption:Key changed) → fall back rather than fail every send.
                logger.LogWarning(ex, "Could not decrypt the stored Slack bot token; falling back to Slack:BotToken config.");
            }
        }

        return string.IsNullOrWhiteSpace(fallback.Value.BotToken) ? null : fallback.Value.BotToken;
    }

    public async Task<bool> IsCategoryEnabledAsync(string category)
    {
        if (await ResolveTokenAsync() is null) return false;

        var row = await db.NotificationChannelSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Category == category);
        return row?.SlackEnabled ?? false;
    }
}

/// <summary>
/// Admin control-panel CRUD for the Slack settings (SuperAdmin). Reads never expose the bot token;
/// writes encrypt it via <see cref="SecretProtector"/> and only replace it when a new one is given.
/// </summary>
public class SlackSettingsService(
    AppDbContext db, SecretProtector protector, IOptions<SlackOptions> fallback, AuditService audit)
{
    public async Task<SlackSettingsDto> GetAsync()
    {
        var row = await db.SlackSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == SlackSettingsResolver.RowId);
        var categories = await GetCategoryDtosAsync();
        var configFallback = !string.IsNullOrWhiteSpace(fallback.Value.BotToken);

        if (row is null)
            return new SlackSettingsDto(Enabled: false, BotTokenSet: false, configFallback, UpdatedAt: null, categories);

        return new SlackSettingsDto(
            row.Enabled, BotTokenSet: !string.IsNullOrEmpty(row.BotTokenEncrypted), configFallback, row.UpdatedAt, categories);
    }

    // xoxb- plus Slack's own token alphabet, length-capped well under what BotTokenEncrypted
    // (varchar(1000), ciphertext) can hold — also rejects CR/LF and other stray characters that
    // would otherwise save fine and then fail on every send once AuthenticationHeaderValue rejects them.
    private static readonly Regex BotTokenPattern = new(@"^xoxb-[A-Za-z0-9-]{1,500}$", RegexOptions.Compiled);

    public async Task<(bool Ok, string? Error)> SaveAsync(UpsertSlackSettingsDto dto, int? actorUserId)
    {
        var token = dto.BotToken?.Trim();
        if (!string.IsNullOrEmpty(token) && !BotTokenPattern.IsMatch(token))
            return (false, "The bot token must look like a Slack Bot User OAuth Token: 'xoxb-' followed by letters, digits and hyphens.");

        foreach (var cat in dto.Categories)
            if (!NotificationCategories.IsValid(cat.Key))
                return (false, $"Unknown notification category '{cat.Key}'.");

        var row = await db.SlackSettings.FirstOrDefaultAsync(s => s.Id == SlackSettingsResolver.RowId);
        if (row is null)
        {
            row = new SlackSetting { Id = SlackSettingsResolver.RowId };
            db.SlackSettings.Add(row);
        }

        row.Enabled = dto.Enabled;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByUserId = actorUserId;

        // Only replace the token when a new one is supplied; blank keeps the existing secret.
        var tokenReplaced = !string.IsNullOrEmpty(token);
        if (tokenReplaced)
            row.BotTokenEncrypted = protector.Protect(token!);

        foreach (var cat in dto.Categories)
        {
            var catRow = await db.NotificationChannelSettings.FirstOrDefaultAsync(s => s.Category == cat.Key);
            if (catRow is null)
            {
                catRow = new NotificationChannelSetting { Category = cat.Key };
                db.NotificationChannelSettings.Add(catRow);
            }
            catRow.SlackEnabled = cat.SlackEnabled;
        }

        await db.SaveChangesAsync();

        // Never record the token itself — but do record what changed, since the categories
        // decide which notifications (and the candidate/job data in them) leave the system.
        var enabledCategories = dto.Categories.Where(c => c.SlackEnabled).Select(c => c.Key).ToList();
        await audit.RecordAsync("Config.SlackUpdated", "SlackSetting", row.Id,
            $"Updated Slack settings (enabled {row.Enabled}, token replaced {tokenReplaced}, " +
            $"categories routed to Slack: {(enabledCategories.Count > 0 ? string.Join(", ", enabledCategories) : "none")})");

        return (true, null);
    }

    private async Task<List<SlackCategorySettingDto>> GetCategoryDtosAsync()
    {
        var rows = await db.NotificationChannelSettings.AsNoTracking()
            .ToDictionaryAsync(s => s.Category, s => s.SlackEnabled);
        return NotificationCategories.All
            .Select(c => new SlackCategorySettingDto(c.Key, c.Label, rows.GetValueOrDefault(c.Key)))
            .ToList();
    }
}
