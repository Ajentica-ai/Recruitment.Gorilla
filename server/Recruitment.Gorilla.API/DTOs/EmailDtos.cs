namespace Recruitment.Gorilla.API.DTOs;

/// <summary>Email delivery settings for the admin control panel. Never carries a secret.</summary>
public record EmailSettingsDto(
    string Provider,           // "Smtp" or "HttpApi"
    string Host,
    int Port,
    string? User,
    string FromAddress,
    string FromName,
    bool UseStartTls,
    string ApiBaseUrl,
    string AllowedRecipientDomains,
    bool Enabled,
    bool PasswordSet,          // true when an SMTP password is stored (so the UI can show "leave blank to keep")
    bool ApiKeySet,            // true when a Notification API key is stored (same)
    DateTime? UpdatedAt
);

/// <summary>
/// Save payload. <see cref="Password"/> and <see cref="ApiKey"/> are write-only: a non-blank value
/// replaces the stored secret; blank/null keeps the existing one. Only the fields for the active
/// <see cref="Provider"/> need to be meaningful; the other provider's fields are ignored.
/// </summary>
public record UpsertEmailSettingsDto(
    string Provider,
    string Host,
    int Port,
    string? User,
    string? Password,
    string FromAddress,
    string FromName,
    bool UseStartTls,
    string? ApiBaseUrl,
    string? ApiKey,
    string? AllowedRecipientDomains,
    bool Enabled
);

public record TestEmailRequestDto(string ToEmail);

/// <summary><see cref="MessageId"/> is set only on a successful send through the Notification API.</summary>
public record TestEmailResultDto(bool Ok, string? Error, string? MessageId = null);

/// <summary>
/// One row of the email delivery log. Deliberately omits the HTML body (it can contain account
/// details), only what's needed to see what was sent, to whom, and whether it worked.
/// </summary>
public record OutboundEmailDto(
    long Id,
    string ToEmail,
    string ToName,
    string Subject,
    string Status,
    string? Provider,
    int Attempts,
    string? LastError,
    string? ProviderMessageId,
    DateTime NextAttemptAt,
    DateTime CreatedAt,
    DateTime? SentAt,
    DateTime UpdatedAt
);

public record ResendEmailResultDto(bool Ok, string? Error);
