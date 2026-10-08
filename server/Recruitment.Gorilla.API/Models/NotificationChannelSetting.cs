namespace Recruitment.Gorilla.API.Models;

/// <summary>
/// Per-category routing for notification channels beyond in-app/email. One row per
/// <see cref="Services.NotificationCategories"/> key; a missing row means every extra channel is off
/// for that category. Named generically (not "SlackChannelSetting") so a future channel can be added
/// as another column here rather than a parallel table.
/// </summary>
public class NotificationChannelSetting
{
    public string Category { get; set; } = string.Empty;
    public bool SlackEnabled { get; set; }
}
