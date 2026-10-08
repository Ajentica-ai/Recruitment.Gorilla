namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Single-row (Id = 1) Slack bot configuration managed from the admin control panel. The token is
/// stored **encrypted** (<see cref="BotTokenEncrypted"/>, protected by <c>SecretProtector</c>) —
/// never in plaintext, never returned to the client. Absence of a row (or <see cref="Enabled"/> =
/// false) means "not configured", and Slack falls back to the <c>Slack:BotToken</c> config section.
/// </summary>
public class SlackSetting
{
    public int Id { get; set; }

    /// <summary>Base64(nonce | tag | ciphertext) of the bot token (xoxb-...). Never plaintext.</summary>
    public string? BotTokenEncrypted { get; set; }

    public bool Enabled { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? UpdatedByUserId { get; set; }
}
