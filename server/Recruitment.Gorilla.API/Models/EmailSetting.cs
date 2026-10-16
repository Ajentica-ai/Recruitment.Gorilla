using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Single-row (Id = 1) outbound email configuration managed from the admin control panel (one active
/// provider at a time, chosen by <see cref="Provider"/>). Secrets are stored encrypted
/// (<see cref="PasswordEncrypted"/>, <see cref="ApiKeyEncrypted"/>, protected by
/// <c>SecretProtector</c>), never in plaintext, never returned to the client. Absence of a row (or
/// <see cref="Enabled"/> = false) means "not configured here", and email falls back to config
/// (the <c>Smtp</c> section, or <c>EmailApi</c> for the HTTP provider).
/// </summary>
public class EmailSetting
{
    public int Id { get; set; }

    /// <summary>One of <see cref="EmailProviders"/>. Defaults to Smtp so existing rows stay on it.</summary>
    public string Provider { get; set; } = EmailProviders.Smtp;

    // ----- SMTP -----
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string? User { get; set; }
    /// <summary>Base64(nonce | tag | ciphertext) of the SMTP password. Never plaintext.</summary>
    public string? PasswordEncrypted { get; set; }
    public string FromAddress { get; set; } = string.Empty;
    public bool UseStartTls { get; set; } = true;

    /// <summary>Display name shown in the recipient's mail client. Shared by both providers.</summary>
    public string FromName { get; set; } = "Recruitment Gorilla";

    // ----- HTTP notification API -----
    public string? ApiBaseUrl { get; set; }
    /// <summary>Base64(nonce | tag | ciphertext) of the API key. Never plaintext.</summary>
    public string? ApiKeyEncrypted { get; set; }
    /// <summary>Comma-separated recipient domains the API is allowed to send to (e.g. "ajentica.ai").</summary>
    public string? AllowedRecipientDomains { get; set; }

    public bool Enabled { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? UpdatedByUserId { get; set; }
}
