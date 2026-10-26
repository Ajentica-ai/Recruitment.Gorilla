using System.Globalization;
using System.Text;

namespace Recruitment.Gorilla.API.Services;

/// <summary>An iCalendar payload ready to attach to an email as <c>text/calendar</c>.</summary>
public record CalendarAttachment(string FileName, string Content, string Method);

/// <summary>Everything the invite needs, so callers don't pass six loose strings.</summary>
public record InterviewInviteDetails(
    int InterviewId,
    string CandidateName,
    string? RoleName,
    DateTime ScheduledAtUtc,
    int DurationMinutes,
    string InterviewUrl,
    /// <summary>
    /// iCalendar SEQUENCE. Clients ignore a re-issued invite for a known UID unless this has
    /// increased, so a reschedule must pass the interview's stored, incremented value.
    /// Defaulted, which keeps every existing call site compiling unchanged.
    /// </summary>
    int Sequence = 0,
    /// <summary>
    /// Used only on the cancel path, where RFC 5545 requires an ORGANIZER and clients drop a
    /// METHOD:CANCEL without one. Normally the configured outbound From address.
    /// </summary>
    string? OrganizerEmail = null);

/// <summary>
/// Builds a standards-based interview invite: an RFC 5545 .ics attachment plus "add to calendar"
/// links. Deliberately provider-neutral — no Google API, no OAuth, no stored credentials — so the
/// same invite works in Google Calendar, Outlook and Apple Calendar.
/// All times are UTC; iCalendar's 'Z' form is unambiguous, and every consuming client renders it
/// in the viewer's own timezone.
/// </summary>
public static class CalendarInvite
{
    private const string ProductId = "-//Recruitment Gorilla//Interview Scheduling//EN";

    /// <summary>Stable per interview, so a client updating the same UID replaces rather than duplicates.</summary>
    public static string Uid(int interviewId) => $"interview-{interviewId}@recruitment-gorilla";

    public static string Summary(string candidateName, string? roleName) =>
        string.IsNullOrWhiteSpace(roleName)
            ? $"Interview: {candidateName}"
            : $"Interview: {candidateName} ({roleName})";

    /// <summary>Last-resort ORGANIZER when no outbound From address is configured.</summary>
    private const string FallbackOrganizer = "no-reply@recruitment-gorilla.local";

    /// <param name="cancelled">
    /// Emits a METHOD:CANCEL / STATUS:CANCELLED payload for the same UID instead of the normal
    /// invite. Honest caveat: because the original was a PUBLISH with no ATTENDEE, Gmail and
    /// Outlook will not reliably remove the event. The cancellation email body is the real
    /// notification; this attachment is best effort.
    /// </param>
    public static CalendarAttachment Build(InterviewInviteDetails d, bool cancelled = false)
    {
        var start = d.ScheduledAtUtc.ToUniversalTime();
        var end = start.AddMinutes(d.DurationMinutes <= 0 ? 60 : d.DurationMinutes);
        var description = $"Interview details and evaluation form: {d.InterviewUrl}";
        var method = cancelled ? "CANCEL" : "PUBLISH";

        // METHOD:PUBLISH, not REQUEST. REQUEST asks the recipient to accept or decline, and those
        // RSVP replies are mailed back to the sender — but this app has no inbox to receive or
        // process them, so they would vanish silently. PUBLISH says "here is the event, add it if
        // you want", which is honest about what the system can actually do. It also avoids the
        // ORGANIZER/From mismatch warnings clients raise when a REQUEST is sent on someone's behalf.
        var lines = new List<string>
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            $"PRODID:{ProductId}",
            "CALSCALE:GREGORIAN",
            $"METHOD:{method}",
            "BEGIN:VEVENT",
            $"UID:{Uid(d.InterviewId)}",
            $"DTSTAMP:{Stamp(DateTime.UtcNow)}",
            $"DTSTART:{Stamp(start)}",
            $"DTEND:{Stamp(end)}",
            $"SEQUENCE:{d.Sequence}",
            cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
            $"SUMMARY:{Escape(Summary(d.CandidateName, d.RoleName))}",
            $"DESCRIPTION:{Escape(description)}",
            $"URL:{Escape(d.InterviewUrl)}",
            "END:VEVENT",
            "END:VCALENDAR",
        };

        if (cancelled)
        {
            var organizer = string.IsNullOrWhiteSpace(d.OrganizerEmail) ? FallbackOrganizer : d.OrganizerEmail;
            lines.Insert(lines.IndexOf("BEGIN:VEVENT") + 1, $"ORGANIZER:mailto:{organizer}");
        }

        // RFC 5545 requires CRLF line endings.
        var content = string.Join("\r\n", lines.Select(Fold)) + "\r\n";
        // The Method must match the body: EmailDispatcher stamps it into the
        // "text/calendar; method=" parameter, and a mismatch makes clients ignore the part.
        return new CalendarAttachment("interview.ics", content, method);
    }

    /// <summary>Prefilled Google Calendar event composer — no account linking required.</summary>
    public static string GoogleUrl(InterviewInviteDetails d)
    {
        var start = d.ScheduledAtUtc.ToUniversalTime();
        var end = start.AddMinutes(d.DurationMinutes <= 0 ? 60 : d.DurationMinutes);
        var q = new Dictionary<string, string>
        {
            ["action"] = "TEMPLATE",
            ["text"] = Summary(d.CandidateName, d.RoleName),
            ["dates"] = $"{Stamp(start)}/{Stamp(end)}",
            ["details"] = $"Interview details and evaluation form: {d.InterviewUrl}",
        };
        return "https://calendar.google.com/calendar/render?" + Query(q);
    }

    /// <summary>The Outlook-on-the-web equivalent, so the invite isn't Google-only.</summary>
    public static string OutlookUrl(InterviewInviteDetails d)
    {
        var start = d.ScheduledAtUtc.ToUniversalTime();
        var end = start.AddMinutes(d.DurationMinutes <= 0 ? 60 : d.DurationMinutes);
        var q = new Dictionary<string, string>
        {
            ["path"] = "/calendar/action/compose",
            ["rru"] = "addevent",
            ["subject"] = Summary(d.CandidateName, d.RoleName),
            ["startdt"] = start.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture),
            ["enddt"] = end.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture),
            ["body"] = $"Interview details and evaluation form: {d.InterviewUrl}",
        };
        return "https://outlook.office.com/calendar/0/deeplink/compose?" + Query(q);
    }

    private static string Query(Dictionary<string, string> parts) =>
        string.Join("&", parts.Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

    /// <summary>iCalendar UTC form: 20260820T083000Z.</summary>
    private static string Stamp(DateTime utc) =>
        utc.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

    /// <summary>
    /// RFC 5545 §3.3.11 — backslash, semicolon and comma are delimiters inside TEXT values and must
    /// be escaped, and newlines become a literal \n. Without this a candidate named "Smith, John"
    /// silently truncates the field in the client.
    /// </summary>
    private static string Escape(string value) => value
        .Replace("\\", "\\\\")
        .Replace(";", "\\;")
        .Replace(",", "\\,")
        .Replace("\r\n", "\\n")
        .Replace("\n", "\\n")
        .Replace("\r", "\\n");

    /// <summary>
    /// RFC 5545 §3.1 — content lines exceeding 75 octets must be folded, with continuations starting
    /// with a space. Counts UTF-8 octets and never splits a character, so non-ASCII names stay intact.
    /// </summary>
    private static string Fold(string line)
    {
        if (Encoding.UTF8.GetByteCount(line) <= 75) return line;

        var sb = new StringBuilder();
        // Octets already on the current physical line, including the leading space on continuations.
        var bytesOnLine = 0;

        foreach (var rune in line.EnumerateRunes())
        {
            var text = rune.ToString();
            var size = Encoding.UTF8.GetByteCount(text);
            if (bytesOnLine + size > 75)
            {
                sb.Append("\r\n ");
                bytesOnLine = 1;
            }
            sb.Append(text);
            bytesOnLine += size;
        }

        return sb.ToString();
    }
}
