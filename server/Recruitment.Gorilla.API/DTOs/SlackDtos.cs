namespace Recruitment.Gorilla.API.DTOs;

/// <summary>One notification category's Slack routing, for the admin control panel.</summary>
public record SlackCategorySettingDto(string Key, string Label, bool SlackEnabled);

/// <summary>Slack settings for the admin control panel — never carries the bot token.</summary>
public record SlackSettingsDto(
    bool Enabled,
    bool BotTokenSet,          // true when a token is stored (so the UI can show "leave blank to keep")
    bool ConfigFallback,       // true when Slack:BotToken is set in config (used even if the DB row isn't enabled)
    DateTime? UpdatedAt,
    List<SlackCategorySettingDto> Categories
);

/// <summary>
/// Save payload. <see cref="BotToken"/> is write-only: a non-blank value replaces the stored
/// token; blank/null keeps the existing one.
/// </summary>
public record UpsertSlackSettingsDto(
    string? BotToken,
    bool Enabled,
    List<UpsertSlackCategoryDto> Categories
);

public record UpsertSlackCategoryDto(string Key, bool SlackEnabled);

public record TestSlackRequestDto(string ToEmail);

public record TestSlackResultDto(bool Ok, string? Error);
