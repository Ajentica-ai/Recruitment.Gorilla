using System.Globalization;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Builds the (subject, HTML body) pair for each transactional email. Plain interpolated HTML with
/// inline styles (email clients don't reliably load external/`<style>` CSS) — no templating library,
/// matching the project's otherwise-lean dependency footprint.
/// </summary>
public static class EmailTemplates
{
    /// <summary>
    /// Stands in for the "open the attached invite" sentence in a stored email body. Whether the
    /// calendar invite actually travels as an attachment depends on which provider ends up sending
    /// this email (and isn't even fixed until send time: the admin can switch providers while a send
    /// is still retrying), so the template can't commit to that sentence up front. The sender
    /// (<c>EmailDispatcher</c>) substitutes the real text, or removes the placeholder, right before
    /// handing the body to a transport.
    /// </summary>
    public const string CalendarNotePlaceholder = "{{calendar-attachment-note}}";

    private static string Wrap(string title, string bodyHtml, string? actionUrl = null, string? actionLabel = null)
    {
        var action = actionUrl is null ? "" : $"""
            <p style="margin-top:20px;">
              <a href="{actionUrl}" style="background:#2b579a;color:#ffffff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block;">{actionLabel}</a>
            </p>
            """;

        return $"""
            <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
              <div style="padding:24px 0;border-bottom:2px solid #2b579a;">
                <span style="font-size:18px;font-weight:600;color:#2b579a;">Recruitment Gorilla</span>
              </div>
              <div style="padding:24px 0;">
                <h2 style="margin:0 0 12px;font-size:16px;">{title}</h2>
                {bodyHtml}
                {action}
              </div>
              <div style="padding:16px 0;border-top:1px solid #e1e1e1;font-size:12px;color:#777777;">
                This is an automated message from Recruitment Gorilla.
              </div>
            </div>
            """;
    }

    public static (string Subject, string Html) InterviewAssigned(
        string interviewerName, string candidateName, string? roleName, DateTime scheduledAt, string interviewUrl,
        InterviewInviteDetails? invite = null)
    {
        var subject = $"Interview assigned: {candidateName}";
        var roleLine = string.IsNullOrWhiteSpace(roleName) ? "" : $"<p>Role: {roleName}</p>";
        // Labelled UTC and formatted invariantly: email is the one surface that cannot know the
        // recipient's timezone, and the server's culture must not change how the time reads.
        var when = scheduledAt.ToUniversalTime()
            .ToString("dd MMM yyyy, HH:mm", CultureInfo.InvariantCulture);

        // Provider links complement the attached .ics: the attachment covers clients that handle
        // invitations natively, the links cover webmail users who'd otherwise have to download it.
        var calendarLinks = invite is null ? "" : $"""
            <p style="margin-top:20px;font-size:13px;color:#555555;">
              Add to your calendar:
              <a href="{CalendarInvite.GoogleUrl(invite)}" style="color:#2b579a;">Google Calendar</a>
              &nbsp;·&nbsp;
              <a href="{CalendarInvite.OutlookUrl(invite)}" style="color:#2b579a;">Outlook</a>
              <br />
              <span style="color:#777777;">{CalendarNotePlaceholder}</span>
            </p>
            """;

        var duration = invite is null ? "" : $"<p>Duration: {invite.DurationMinutes} minutes</p>";

        var body = $"""
            <p>Hi {interviewerName},</p>
            <p>You've been assigned to interview <strong>{candidateName}</strong>.</p>
            {roleLine}
            <p>Scheduled for: <strong>{when} UTC</strong></p>
            {duration}
            {calendarLinks}
            """;
        return (subject, Wrap(subject, body, interviewUrl, "View interview"));
    }

    public static (string Subject, string Html) PasswordChanged(string userName)
    {
        const string subject = "Your password was changed";
        var body = $"""
            <p>Hi {userName},</p>
            <p>Your Recruitment Gorilla account password was just changed. If you made this change, no action is needed.</p>
            <p>If you didn't make this change, contact your administrator immediately.</p>
            """;
        return (subject, Wrap(subject, body));
    }

    public static (string Subject, string Html) PasswordReset(string userName)
    {
        const string subject = "Your password was reset";
        var body = $"""
            <p>Hi {userName},</p>
            <p>An administrator reset your Recruitment Gorilla account password. Contact them to get your new temporary password, then sign in and set a new one.</p>
            """;
        return (subject, Wrap(subject, body));
    }

    public static (string Subject, string Html) AccountCreated(string userName)
    {
        const string subject = "Your Recruitment Gorilla account was created";
        var body = $"""
            <p>Hi {userName},</p>
            <p>An account was created for you on Recruitment Gorilla. Your administrator will provide your temporary password — sign in and you'll be asked to set a new one.</p>
            """;
        return (subject, Wrap(subject, body));
    }
}
