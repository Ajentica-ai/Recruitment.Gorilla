using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EmailDispatcher: pure, no DB, no real network (fake ISmtpTransport + resolver). Covers building the
/// MIME message (including the calendar attachment) and mapping SMTP failures to the right
/// <see cref="EmailOutcome"/> for the outbox processor to act on.
/// </summary>
public class EmailDispatcherTests
{
    private sealed class RecordingTransport : ISmtpTransport
    {
        public MimeMessage? Sent;
        public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default)
        {
            Sent = message;
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingTransport(Exception toThrow) : ISmtpTransport
    {
        public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default) =>
            throw toThrow;
    }

    private sealed class FakeResolver(SmtpOptions options) : IEmailSettingsResolver
    {
        public Task<SmtpOptions> ResolveAsync() => Task.FromResult(options);
    }

    private static EmailDispatcher Dispatcher(ISmtpTransport transport, SmtpOptions? options = null) => new(
        new FakeResolver(options ?? new SmtpOptions { Host = "smtp.test.local", FromAddress = "noreply@test.local" }),
        transport);

    private static EmailSendRequest Request(CalendarAttachment? calendar = null) =>
        new("candidate@example.com", "Jane Doe", "Hello", "<p>Hi</p>", calendar, Guid.NewGuid().ToString());

    [Fact]
    public async Task SendAsync_passes_recipient_subject_and_body_to_the_transport()
    {
        var transport = new RecordingTransport();
        await Dispatcher(transport).SendAsync(Request());

        Assert.NotNull(transport.Sent);
        Assert.Equal("candidate@example.com", transport.Sent!.To.Mailboxes.Single().Address);
        Assert.Equal("Jane Doe", transport.Sent.To.Mailboxes.Single().Name);
        Assert.Equal("Hello", transport.Sent.Subject);
        Assert.Equal("noreply@test.local", transport.Sent.From.Mailboxes.Single().Address);
    }

    [Fact]
    public async Task SendAsync_throws_a_permanent_failure_when_smtp_is_not_configured()
    {
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            Dispatcher(new RecordingTransport(), new SmtpOptions()).SendAsync(Request()));

        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_without_a_calendar_stays_a_plain_html_body()
    {
        var transport = new RecordingTransport();
        await Dispatcher(transport).SendAsync(Request());

        // Regression guard: the multipart branch must not affect ordinary transactional mail.
        Assert.IsType<TextPart>(transport.Sent!.Body);
    }

    [Fact]
    public async Task SendAsync_attaches_the_calendar_invite_as_text_calendar()
    {
        var transport = new RecordingTransport();
        var invite = new InterviewInviteDetails(
            7, "Jane Doe", "Backend Engineer",
            new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc), 45,
            "http://localhost:5173/interviews/7");

        await Dispatcher(transport).SendAsync(Request(CalendarInvite.Build(invite)));

        var multipart = Assert.IsType<Multipart>(transport.Sent!.Body);
        var calendarPart = multipart.OfType<TextPart>()
            .Single(p => p.ContentType.MediaSubtype == "calendar");

        // The method parameter is what makes clients offer "add to calendar" rather than a download.
        Assert.Equal("PUBLISH", calendarPart.ContentType.Parameters["method"]);
        Assert.Equal("interview.ics", calendarPart.ContentDisposition?.FileName);
        Assert.Contains("DTSTART:20260820T083000Z", calendarPart.Text);
        Assert.Contains("DTEND:20260820T091500Z", calendarPart.Text);
    }

    [Fact]
    public async Task SendAsync_treats_bad_credentials_as_a_permanent_failure()
    {
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            Dispatcher(new ThrowingTransport(new AuthenticationException("bad credentials"))).SendAsync(Request()));

        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_treats_a_5xx_smtp_reply_as_a_permanent_failure()
    {
        var rejection = new SmtpCommandException(
            SmtpErrorCode.RecipientNotAccepted, SmtpStatusCode.MailboxUnavailable, "mailbox unavailable");

        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            Dispatcher(new ThrowingTransport(rejection)).SendAsync(Request()));

        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_treats_a_connection_failure_as_retryable()
    {
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            Dispatcher(new ThrowingTransport(new System.Net.Sockets.SocketException())).SendAsync(Request()));

        Assert.Equal(EmailOutcome.Retry, ex.Outcome);
    }
}
