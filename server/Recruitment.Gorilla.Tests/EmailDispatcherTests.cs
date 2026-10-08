using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

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
        public Task<EmailDeliveryOptions> ResolveAsync() =>
            Task.FromResult(new EmailDeliveryOptions { Provider = EmailProviders.Smtp, Smtp = options });
    }

    private static EmailDispatcher Dispatcher(ISmtpTransport transport, SmtpOptions? options = null) => new(
        new FakeResolver(options ?? new SmtpOptions { Host = "smtp.test.local", FromAddress = "noreply@test.local" }),
        transport,
        new NoOpEmailApiTransport());

    private static EmailSendRequest Request(
        CalendarAttachment? calendar = null, string html = "<p>Hi</p>", string toEmail = "candidate@example.com", string? reference = null) =>
        new(toEmail, "Jane Doe", "Hello", html, calendar, reference ?? Guid.NewGuid().ToString());

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

    [Fact]
    public async Task SendAsync_attaches_the_resolved_provider_to_a_thrown_exception()
    {
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            Dispatcher(new ThrowingTransport(new System.Net.Sockets.SocketException())).SendAsync(Request()));

        Assert.Equal(EmailProviders.Smtp, ex.Provider);
    }

    [Fact]
    public async Task SendAsync_on_success_reports_the_provider_that_sent_it()
    {
        var result = await Dispatcher(new RecordingTransport()).SendAsync(Request());

        Assert.Equal(EmailProviders.Smtp, result.Provider);
        Assert.Null(result.MessageId); // plain SMTP has no delivery id to report back
    }

    // ----- HTTP notification API provider -----

    private sealed class RecordingApiTransport : IEmailApiTransport
    {
        public EmailApiSendRequest? Sent;

        public Task<string?> SendAsync(EmailApiSendRequest request, EmailApiOptions options, CancellationToken ct = default)
        {
            Sent = request;
            return Task.FromResult<string?>("api-msg-1");
        }

        public Task<EmailApiStatusResult> GetStatusAsync(string reference, EmailApiOptions options, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Sent, "api-msg-1"));
    }

    private sealed class ApiResolver(EmailApiOptions options) : IEmailSettingsResolver
    {
        public Task<EmailDeliveryOptions> ResolveAsync() =>
            Task.FromResult(new EmailDeliveryOptions { Provider = EmailProviders.HttpApi, Api = options });
    }

    private static EmailApiOptions ApiOptions(string allowedDomains = "ajentica.ai", bool supportsAttachments = false) => new()
    {
        BaseUrl = "https://notify.example.com",
        ApiKey = "test-key",
        FromName = "Recruitment Gorilla",
        AllowedRecipientDomains = allowedDomains,
        SupportsAttachments = supportsAttachments,
    };

    private static EmailDispatcher ApiDispatcher(IEmailApiTransport apiTransport, EmailApiOptions? options = null) => new(
        new ApiResolver(options ?? ApiOptions()), new RecordingTransport(), apiTransport);

    [Fact]
    public async Task SendAsync_via_the_api_sends_the_html_and_a_derived_text_body()
    {
        var api = new RecordingApiTransport();
        var result = await ApiDispatcher(api).SendAsync(
            Request(html: "<p>Hi there</p>", toEmail: "jane@ajentica.ai", reference: "ref-123"));

        Assert.Equal(EmailProviders.HttpApi, result.Provider);
        Assert.Equal("api-msg-1", result.MessageId);
        Assert.NotNull(api.Sent);
        Assert.Equal("jane@ajentica.ai", api.Sent!.ToEmail);
        Assert.Equal("<p>Hi there</p>", api.Sent.HtmlBody);
        Assert.Equal("Hi there", api.Sent.TextBody);
        Assert.Equal("Recruitment Gorilla", api.Sent.FromName);
        Assert.Equal("ref-123", api.Sent.Reference);
    }

    [Fact]
    public async Task SendAsync_via_the_api_rejects_a_recipient_outside_the_allowed_domains()
    {
        var api = new RecordingApiTransport();
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            ApiDispatcher(api, ApiOptions()).SendAsync(Request(toEmail: "someone@elsewhere.com")));

        Assert.Equal("recipient_domain_not_allowed", ex.Code);
        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
        Assert.Null(api.Sent); // never even reached the transport
    }

    [Theory]
    [InlineData("evil@other.com@ajentica.ai")] // text after the last '@' looks allowed, the address isn't
    [InlineData("evil@gmail.com,ok@ajentica.ai")] // a smuggled second recipient
    [InlineData("jane@ajentica.ai\r\nBcc: evil@gmail.com")] // header injection attempt
    [InlineData("not-an-email")]
    public async Task SendAsync_via_the_api_rejects_a_malformed_recipient_even_if_it_ends_in_an_allowed_domain(string toEmail)
    {
        var api = new RecordingApiTransport();
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            ApiDispatcher(api, ApiOptions()).SendAsync(Request(toEmail: toEmail)));

        Assert.Equal("recipient_domain_not_allowed", ex.Code);
        Assert.Null(api.Sent);
    }

    [Fact]
    public async Task SendAsync_via_the_api_throws_permanent_when_not_configured()
    {
        var ex = await Assert.ThrowsAsync<EmailDeliveryException>(() =>
            ApiDispatcher(new RecordingApiTransport(), new EmailApiOptions()).SendAsync(Request(toEmail: "jane@ajentica.ai")));

        Assert.Equal("not_configured", ex.Code);
        Assert.Equal(EmailOutcome.Permanent, ex.Outcome);
    }

    [Fact]
    public async Task SendAsync_via_the_api_drops_the_calendar_note_when_attachments_are_unsupported()
    {
        var invite = new InterviewInviteDetails(
            7, "Jane Doe", "Backend Engineer", new DateTime(2026, 8, 20, 8, 30, 0, DateTimeKind.Utc), 45,
            "http://localhost:5173/interviews/7");
        var (_, html) = EmailTemplates.InterviewAssigned("Ivy", "Jane Doe", "Backend Engineer", invite.ScheduledAtUtc,
            "http://localhost:5173/interviews/7", invite);

        var api = new RecordingApiTransport();
        await ApiDispatcher(api, ApiOptions(supportsAttachments: false))
            .SendAsync(new EmailSendRequest("jane@ajentica.ai", "Jane", "Interview", html, CalendarInvite.Build(invite), "ref-cal"));

        Assert.DoesNotContain("attached invite", api.Sent!.HtmlBody);
        Assert.DoesNotContain(EmailTemplates.CalendarNotePlaceholder, api.Sent.HtmlBody);
    }

    [Fact]
    public async Task CheckStatusAsync_delegates_to_the_api_transport_when_that_is_the_active_provider()
    {
        var result = await ApiDispatcher(new RecordingApiTransport()).CheckStatusAsync("ref-123");

        Assert.Equal(EmailApiDeliveryStatus.Sent, result.Status);
        Assert.Equal("api-msg-1", result.MessageId);
    }

    [Fact]
    public async Task CheckStatusAsync_is_unsupported_when_the_active_provider_is_smtp()
    {
        var result = await Dispatcher(new RecordingTransport()).CheckStatusAsync("ref-123");

        Assert.Equal(EmailApiDeliveryStatus.Unsupported, result.Status);
    }
}
