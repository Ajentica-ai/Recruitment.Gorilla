using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Per-user in-app notifications (list, unread count, mark read) and the shared dispatch path for
/// pairing an in-app notification with the matching transactional email and/or Slack DM.
/// </summary>
public class NotificationService(AppDbContext db, EmailService emailService, SlackService slackService)
{
    /// <summary>
    /// Records the in-app notification and, when an email subject/body is supplied and/or
    /// <paramref name="category"/> names a Slack-routable notification category, sends the matching
    /// email and/or Slack DM to the user's email address. The single entry point new triggers should
    /// use so in-app, email and Slack notifications never drift apart.
    /// </summary>
    public async Task NotifyAsync(
        int userId, string title, string message, string? linkUrl,
        string? emailSubject = null, string? emailHtmlBody = null, CalendarAttachment? calendar = null,
        string? category = null)
    {
        db.Notifications.Add(new Notification { UserId = userId, Title = title, Message = message, LinkUrl = linkUrl });
        await db.SaveChangesAsync();

        var sendEmail = emailSubject is not null && emailHtmlBody is not null;
        if (!sendEmail && category is null) return;

        var user = await db.Users.FindAsync(userId);
        if (user is null || string.IsNullOrWhiteSpace(user.Email)) return;

        if (sendEmail)
            await emailService.SendAsync(user.Email, user.Name, emailSubject!, emailHtmlBody!, calendar);

        if (category is not null)
            await slackService.EnqueueAsync(category, user.Email, title, message, linkUrl);
    }

    public async Task<NotificationListDto> GetMineAsync(int userId, int take = 15)
    {
        var items = await db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new NotificationDto(n.Id, n.Title, n.Message, n.LinkUrl, n.IsRead, n.CreatedAt))
            .ToListAsync();

        var unread = await db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return new NotificationListDto(items, unread);
    }

    /// <summary>Marks one notification read. False if it doesn't exist or isn't the user's.</summary>
    public async Task<bool> MarkReadAsync(int id, int userId)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (n is null) return false;
        if (!n.IsRead)
        {
            n.IsRead = true;
            await db.SaveChangesAsync();
        }
        return true;
    }

    public async Task MarkAllReadAsync(int userId)
    {
        var unread = await db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
        if (unread.Count == 0) return;
        foreach (var n in unread) n.IsRead = true;
        await db.SaveChangesAsync();
    }
}
