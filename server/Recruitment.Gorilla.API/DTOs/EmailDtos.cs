namespace Recruitment.Gorilla.API.DTOs;

/// <summary>SMTP settings for the admin control panel — never carries the password.</summary>
public record EmailSettingsDto(
    string Host,
    int Port,
    string? User,
    string FromAddress,
    string FromName,
    bool UseStartTls,
    bool Enabled,
    bool PasswordSet,          // true when a password is stored (so the UI can show "leave blank to keep")
    DateTime? UpdatedAt
);

/// <summary>
/// Save payload. <see cref="Password"/> is write-only: a non-blank value replaces the stored
/// password; blank/null keeps the existing one.
/// </summary>
public record UpsertEmailSettingsDto(
    string Host,
    int Port,
    string? User,
    string? Password,
    string FromAddress,
    string FromName,
    bool UseStartTls,
    bool Enabled
);

public record TestEmailRequestDto(string ToEmail);

public record TestEmailResultDto(bool Ok, string? Error);

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
