using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EmailTemplates.InterviewAssigned: the calendar-note placeholder is emitted exactly when there's an
/// invite to note, and never the hardcoded "attached invite" sentence itself — whichever provider ends
/// up sending this email decides, at send time, whether an attachment actually goes out (see
/// EmailDispatcher), so the template can't commit to that wording up front.
/// </summary>
public class EmailTemplatesTests
{
    private static InterviewInviteDetails Invite() => new(
        7, "Jane Doe", "Backend Engineer", new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc), 45,
        "http://localhost:5173/interviews/7");

    [Fact]
    public void InterviewAssigned_with_an_invite_emits_the_placeholder_not_the_sentence()
    {
        var invite = Invite();
        var (_, html) = EmailTemplates.InterviewAssigned(
            "Ivy", "Jane Doe", "Backend Engineer", invite.ScheduledAtUtc, "http://localhost:5173/interviews/7", invite);

        Assert.Contains(EmailTemplates.CalendarNotePlaceholder, html);
        Assert.DoesNotContain("attached invite", html);
    }

    [Fact]
    public void InterviewAssigned_without_an_invite_has_no_calendar_section_at_all()
    {
        var (_, html) = EmailTemplates.InterviewAssigned(
            "Ivy", "Jane Doe", "Backend Engineer", DateTime.UtcNow, "http://localhost:5173/interviews/7");

        Assert.DoesNotContain(EmailTemplates.CalendarNotePlaceholder, html);
        Assert.DoesNotContain("Add to your calendar", html);
    }
}
