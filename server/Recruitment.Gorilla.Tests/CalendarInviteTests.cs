using System.Text;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The .ics is consumed by Google Calendar, Outlook and Apple Calendar, all of which reject or
/// silently mangle malformed input — so the RFC 5545 details (UTC stamps, TEXT escaping, 75-octet
/// folding, CRLF) are pinned here rather than discovered in someone's inbox.
/// </summary>
public class CalendarInviteTests
{
    private static InterviewInviteDetails Invite(
        string candidate = "Jane Doe", string? role = "Backend Engineer",
        int durationMinutes = 60, DateTime? at = null) =>
        new(42, candidate, role,
            at ?? new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc),
            durationMinutes,
            "http://localhost:5173/interviews/42");

    [Fact]
    public void Ics_carries_UTC_start_and_end_derived_from_the_duration()
    {
        var ics = CalendarInvite.Build(Invite(durationMinutes: 45)).Content;

        Assert.Contains("DTSTART:20260820T083000Z", ics);
        Assert.Contains("DTEND:20260820T091500Z", ics);
    }

    [Fact]
    public void A_local_kind_start_is_normalized_to_UTC()
    {
        // Guards the timezone contract: whatever Kind arrives, the invite must emit true UTC.
        var local = new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc).ToLocalTime();
        var ics = CalendarInvite.Build(Invite(at: DateTime.SpecifyKind(local, DateTimeKind.Local))).Content;

        Assert.Contains("DTSTART:20260820T083000Z", ics);
    }

    [Fact]
    public void Uses_PUBLISH_because_the_app_cannot_receive_RSVP_replies()
    {
        var ics = CalendarInvite.Build(Invite()).Content;

        Assert.Contains("METHOD:PUBLISH", ics);
        Assert.DoesNotContain("METHOD:REQUEST", ics);
        Assert.DoesNotContain("RSVP=TRUE", ics);
    }

    [Fact]
    public void Sequence_reflects_the_value_passed()
    {
        // A re-issued invite for a known UID whose SEQUENCE has not grown is ignored by every
        // major client, so a reschedule that forgot this would leave calendars on the old time.
        var ics = CalendarInvite.Build(Invite() with { Sequence = 3 }).Content;

        Assert.Contains("SEQUENCE:3", ics);
        Assert.DoesNotContain("SEQUENCE:0", ics);
    }

    [Fact]
    public void Sequence_defaults_to_zero_for_a_first_invite()
    {
        Assert.Contains("SEQUENCE:0", CalendarInvite.Build(Invite()).Content);
    }

    [Fact]
    public void Cancelling_emits_CANCEL_and_STATUS_CANCELLED_for_the_unchanged_uid()
    {
        var invite = Invite() with { Sequence = 2, OrganizerEmail = "recruiting@example.com" };

        var normal = CalendarInvite.Build(invite);
        var cancelled = CalendarInvite.Build(invite, cancelled: true);

        Assert.Contains("METHOD:CANCEL", cancelled.Content);
        Assert.Contains("STATUS:CANCELLED", cancelled.Content);
        Assert.DoesNotContain("STATUS:CONFIRMED", cancelled.Content);
        // The UID is what lets a client match the cancellation to the event it already has.
        Assert.Contains($"UID:{CalendarInvite.Uid(42)}", cancelled.Content);
        Assert.Contains($"UID:{CalendarInvite.Uid(42)}", normal.Content);
    }

    [Fact]
    public void A_cancellation_carries_an_ORGANIZER_because_clients_drop_it_otherwise()
    {
        var cancelled = CalendarInvite.Build(
            Invite() with { OrganizerEmail = "recruiting@example.com" }, cancelled: true).Content;

        Assert.Contains("ORGANIZER:mailto:recruiting@example.com", cancelled);
        // RFC 5545 requires it on a CANCEL, so it must be present even with nothing configured.
        var noConfig = CalendarInvite.Build(Invite(), cancelled: true).Content;
        Assert.Contains("ORGANIZER:mailto:", noConfig);
    }

    [Fact]
    public void A_normal_invite_carries_no_ORGANIZER()
    {
        // PUBLISH deliberately has no organizer/attendee: see the comment in CalendarInvite.Build.
        Assert.DoesNotContain("ORGANIZER", CalendarInvite.Build(Invite()).Content);
    }

    [Fact]
    public void Attachment_method_matches_the_body_on_both_paths()
    {
        // EmailDispatcher stamps this into "text/calendar; method=", and a mismatch makes
        // clients ignore the calendar part entirely.
        Assert.Equal("PUBLISH", CalendarInvite.Build(Invite()).Method);
        Assert.Equal("CANCEL", CalendarInvite.Build(Invite(), cancelled: true).Method);
    }

    [Fact]
    public void Commas_and_semicolons_in_a_name_are_escaped()
    {
        // Unescaped, "Smith, John" would truncate SUMMARY at the comma in most clients.
        var ics = CalendarInvite.Build(Invite(candidate: "Smith, John; Jr", role: null)).Content;

        Assert.Contains(@"SUMMARY:Interview: Smith\, John\; Jr", ics);
    }

    [Fact]
    public void Backslashes_and_newlines_are_escaped()
    {
        var ics = CalendarInvite.Build(Invite(candidate: "A\\B\nC", role: null)).Content;

        Assert.Contains(@"A\\B\nC", ics);
        // The literal newline must not survive — it would end the content line early.
        Assert.DoesNotContain("A\\B\nC", ics);
    }

    [Fact]
    public void Long_lines_are_folded_at_75_octets_with_a_leading_space()
    {
        var ics = CalendarInvite.Build(Invite(candidate: new string('X', 200), role: null)).Content;

        foreach (var line in ics.Split("\r\n", StringSplitOptions.RemoveEmptyEntries))
            Assert.True(Encoding.UTF8.GetByteCount(line) <= 75,
                $"Line exceeds the 75-octet limit ({Encoding.UTF8.GetByteCount(line)}): {line}");

        Assert.Contains("\r\n ", ics);
    }

    [Fact]
    public void Folding_never_splits_a_multibyte_character()
    {
        // 'é' is two octets in UTF-8; a naive byte-wise fold would cut it in half.
        var ics = CalendarInvite.Build(Invite(candidate: string.Concat(Enumerable.Repeat("é", 120)), role: null));

        // Round-tripping through UTF-8 proves no lone surrogate or truncated sequence was emitted.
        var bytes = Encoding.UTF8.GetBytes(ics.Content);
        Assert.Equal(ics.Content, Encoding.UTF8.GetString(bytes));
        Assert.Contains("é", ics.Content);
    }

    [Fact]
    public void Uses_CRLF_and_is_a_well_formed_VCALENDAR()
    {
        var ics = CalendarInvite.Build(Invite()).Content;

        Assert.StartsWith("BEGIN:VCALENDAR\r\n", ics);
        Assert.EndsWith("END:VCALENDAR\r\n", ics);
        Assert.Contains("UID:interview-42@recruitment-gorilla", ics);
        // A bare LF (one not preceded by CR) would break strict parsers.
        Assert.DoesNotMatch("(?<!\r)\n", ics);
    }

    [Fact]
    public void A_nonsensical_duration_falls_back_to_an_hour()
    {
        var ics = CalendarInvite.Build(Invite(durationMinutes: 0)).Content;

        Assert.Contains("DTEND:20260820T093000Z", ics);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(60)]
    public void Provider_links_are_url_encoded_and_carry_the_window(int duration)
    {
        var invite = Invite(candidate: "Smith, John", duration: duration);

        var google = CalendarInvite.GoogleUrl(invite);
        var outlook = CalendarInvite.OutlookUrl(invite);

        Assert.StartsWith("https://calendar.google.com/calendar/render?", google);
        Assert.Contains("dates=20260820T083000Z", google);
        // The raw comma must not leak into the query string unencoded.
        Assert.Contains("Smith%2C%20John", google);

        Assert.StartsWith("https://outlook.office.com/calendar/0/deeplink/compose?", outlook);
        Assert.Contains("startdt=2026-08-20T08%3A30%3A00Z", outlook);
    }

    private static InterviewInviteDetails Invite(string candidate, int duration) =>
        Invite(candidate: candidate, role: null, durationMinutes: duration);
}
