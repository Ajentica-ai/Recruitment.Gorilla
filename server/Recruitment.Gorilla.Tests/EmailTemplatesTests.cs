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
    public void InterviewRescheduled_carries_both_the_old_and_the_new_time()
    {
        var invite = Invite();
        var previous = new DateTime(2026, 8, 18, 9, 0, 0, DateTimeKind.Utc);
        var (subject, html) = EmailTemplates.InterviewRescheduled(
            "Ivy", "Jane Doe", "Backend Engineer", previous, invite.ScheduledAtUtc,
            "http://localhost:5173/interviews/7", "Candidate asked for Thursday", invite);

        Assert.Contains("Jane Doe", subject);
        // Both times, so the reader can tell what changed without opening the app.
        Assert.Contains("18 Aug 2026, 09:00", html);
        Assert.Contains("20 Aug 2026, 08:30", html);
        Assert.Contains("Candidate asked for Thursday", html);
        Assert.Contains(EmailTemplates.CalendarNotePlaceholder, html);
        Assert.DoesNotContain("attached invite", html);
    }

    [Fact]
    public void InterviewCancelled_states_the_reason_and_offers_no_calendar_links()
    {
        var (subject, html) = EmailTemplates.InterviewCancelled(
            "Ivy", "Jane Doe", "Backend Engineer",
            new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc), "Role put on hold");

        Assert.Contains("cancelled", subject, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("20 Aug 2026, 08:30", html);
        Assert.Contains("Role put on hold", html);
        // There is nothing left to add to a calendar.
        Assert.DoesNotContain("Add to your calendar", html);
        Assert.DoesNotContain("calendar.google.com", html);
    }

    [Fact]
    public void InterviewCancelled_tells_a_dropped_interviewer_they_are_off_the_panel()
    {
        var (subject, html) = EmailTemplates.InterviewCancelled(
            "Ivy", "Jane Doe", null, DateTime.UtcNow, "Panel reshuffled", removedFromPanel: true);

        Assert.Contains("removed", subject, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("no longer on the interview panel", html);
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
