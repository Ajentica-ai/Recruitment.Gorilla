using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EmailService.SendAsync: writes a durable <see cref="OutboundEmail"/> row and returns; it never
/// talks to the network itself (that's <see cref="EmailDispatcher"/>, exercised by
/// <see cref="EmailDispatcherTests"/>, and <see cref="Recruitment.Gorilla.API.Services.Background.EmailOutboxProcessor"/>,
/// exercised by <c>EmailOutboxTests</c>).
/// </summary>
public class EmailServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    [Fact]
    public async Task SendAsync_queues_a_pending_outbound_email()
    {
        await TestEmail().SendAsync("candidate@example.com", "Jane Doe", "Hello", "<p>Hi</p>");

        var row = await Db.OutboundEmails.SingleAsync(e => e.ToEmail == "candidate@example.com");
        Assert.Equal("Jane Doe", row.ToName);
        Assert.Equal("Hello", row.Subject);
        Assert.Equal("<p>Hi</p>", row.HtmlBody);
        Assert.Equal(OutboundEmailStatus.Pending, row.Status);
        Assert.Equal(0, row.Attempts);
        Assert.Null(row.SentAt);
    }

    [Fact]
    public async Task SendAsync_ignores_a_blank_recipient()
    {
        var before = await Db.OutboundEmails.CountAsync();
        await TestEmail().SendAsync("", "A", "Subject", "<p>x</p>");

        Assert.Equal(before, await Db.OutboundEmails.CountAsync());
    }

    [Fact]
    public async Task SendAsync_stores_the_calendar_invite_alongside_the_email()
    {
        var invite = new InterviewInviteDetails(
            7, "Jane Doe", "Backend Engineer",
            new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc), 45,
            "http://localhost:5173/interviews/7");

        await TestEmail().SendAsync(
            "candidate@example.com", "Jane Doe", "Interview assigned", "<p>x</p>", CalendarInvite.Build(invite));

        var row = await Db.OutboundEmails.SingleAsync(e => e.ToEmail == "candidate@example.com");
        Assert.Equal("interview.ics", row.CalendarFileName);
        Assert.Equal("PUBLISH", row.CalendarMethod);
        Assert.Contains("DTSTART:20260820T083000Z", row.CalendarContent);
    }

    [Fact]
    public async Task SendTestAsync_sends_immediately_and_bypasses_the_outbox()
    {
        var sent = false;
        var dispatcher = new RecordingDispatcher(() => sent = true);
        var service = new EmailService(Db, dispatcher, NullLogger<EmailService>.Instance);

        await service.SendTestAsync("a@b.com", "A", "Test", "<p>x</p>");

        Assert.True(sent);
        Assert.False(await Db.OutboundEmails.AnyAsync(e => e.ToEmail == "a@b.com"));
    }

    [Fact]
    public async Task SendTestAsync_lets_a_delivery_failure_propagate()
    {
        var service = new EmailService(
            Db, new ThrowingDispatcher(), NullLogger<EmailService>.Instance);

        await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            service.SendTestAsync("a@b.com", "A", "Test", "<p>x</p>"));
    }

    private sealed class RecordingDispatcher(Action onSend) : IEmailDispatcher
    {
        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
        {
            onSend();
            return Task.FromResult(new EmailSendResult(EmailProviders.Smtp, null));
        }

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported));
    }

    private sealed class ThrowingDispatcher : IEmailDispatcher
    {
        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default) =>
            throw new EmailDeliveryException("test_failure", EmailOutcome.Permanent);

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported));
    }
}

/// <summary>
/// Not a <see cref="DbTestBase"/> test: it needs a context that genuinely fails to save, which the
/// shared transactional test database can't give us.
/// </summary>
[Collection(MySqlCollection.Name)]
public class EmailServiceFailureTests(MySqlDatabaseFixture fixture)
{
    [Fact]
    public async Task SendAsync_swallows_a_database_failure_and_never_throws()
    {
        // A context that's already disposed fails every operation immediately and deterministically,
        // so no real outage needs simulating to prove SendAsync never lets a save failure escape.
        var db = fixture.NewContext();
        await db.DisposeAsync();

        var service = new EmailService(
            db,
            new EmailDispatcher(new NeverCalledResolver(), new NeverCalledTransport(), new NoOpEmailApiTransport()),
            NullLogger<EmailService>.Instance);

        var ex = await Record.ExceptionAsync(() => service.SendAsync("a@b.com", "A", "Subject", "<p>x</p>"));

        Assert.Null(ex);
    }

    private sealed class NeverCalledResolver : IEmailSettingsResolver
    {
        public Task<EmailDeliveryOptions> ResolveAsync() => throw new InvalidOperationException("should never be reached");
    }

    private sealed class NeverCalledTransport : ISmtpTransport
    {
        public Task SendAsync(MimeKit.MimeMessage message, SmtpOptions options, CancellationToken ct = default) =>
            throw new InvalidOperationException("should never be reached");
    }
}
