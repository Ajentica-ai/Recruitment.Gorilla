using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.API.Services.Background;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// EmailOutboxProcessor: claims due <see cref="OutboundEmail"/> rows and applies the retry policy.
/// EmailService's write side is covered by <see cref="EmailServiceTests"/>; the actual SMTP send and
/// its failure classification by <see cref="EmailDispatcherTests"/>.
/// </summary>
public class EmailOutboxTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FixedOutcomeDispatcher(EmailOutcome outcome, string code = "test_failure") : IEmailDispatcher
    {
        public int Calls;
        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
        {
            Calls++;
            throw new EmailDeliveryException(code, outcome);
        }

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported));
    }

    private sealed class SucceedingDispatcher(string? messageId = "msg-1") : IEmailDispatcher
    {
        public int Calls;
        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
        {
            Calls++;
            return Task.FromResult(new EmailSendResult(EmailProviders.Smtp, messageId));
        }

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(EmailApiDeliveryStatus.Unsupported));
    }

    /// <summary>A dispatcher whose CheckStatusAsync answer is fixed, and whose SendAsync (the resend
    /// path) succeeds and records how many times it was actually called.</summary>
    private sealed class StatusCheckDispatcher(EmailApiDeliveryStatus status, string? messageId = null) : IEmailDispatcher
    {
        public int SendCalls;

        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
        {
            SendCalls++;
            return Task.FromResult(new EmailSendResult(EmailProviders.HttpApi, "resent-msg"));
        }

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            Task.FromResult(new EmailApiStatusResult(status, messageId));
    }

    /// <summary>Simulates CheckStatusAsync failing before it even reaches the provider (e.g. the stored
    /// API key fails to decrypt): the part of the status-check path that genuinely can throw.</summary>
    private sealed class ThrowingStatusCheckDispatcher : IEmailDispatcher
    {
        public int SendCalls;

        public Task<EmailSendResult> SendAsync(EmailSendRequest request, CancellationToken ct = default)
        {
            SendCalls++;
            return Task.FromResult(new EmailSendResult(EmailProviders.HttpApi, "resent-msg"));
        }

        public Task<EmailApiStatusResult> CheckStatusAsync(string reference, CancellationToken ct = default) =>
            throw new InvalidOperationException("could not decrypt the stored API key");
    }

    private async Task<OutboundEmail> AddRowAsync(
        string status = OutboundEmailStatus.Pending, DateTime? nextAttemptAt = null,
        DateTime? lockedUntil = null, int attempts = 0, DateTime? updatedAt = null, bool needsStatusCheck = false)
    {
        var row = new OutboundEmail
        {
            ToEmail = $"{Guid.NewGuid():N}@example.com",
            ToName = "Test Recipient",
            Subject = "Subject",
            HtmlBody = "<p>Body</p>",
            Status = status,
            Attempts = attempts,
            NextAttemptAt = nextAttemptAt ?? DateTime.UtcNow.AddMinutes(-1),
            LockedUntil = lockedUntil,
            NeedsStatusCheck = needsStatusCheck,
            UpdatedAt = updatedAt ?? DateTime.UtcNow,
        };
        Db.OutboundEmails.Add(row);
        await Db.SaveChangesAsync();

        // Detach: the processor under test shares this same Db instance (the point of DbTestBase's
        // transactional-context pattern), and a tracking query for this row would otherwise return
        // this very (now stale) in-memory instance instead of reflecting the processor's own bulk
        // ExecuteUpdateAsync claim (EF Core's identity resolution, not a production concern, since a
        // real worker always processes through its own freshly scoped DbContext).
        Db.Entry(row).State = EntityState.Detached;
        return row;
    }

    private async Task<OutboundEmail> ReloadAsync(long id) =>
        await Db.OutboundEmails.AsNoTracking().SingleAsync(e => e.Id == id);

    [Fact]
    public async Task ProcessDueAsync_sends_a_due_pending_email_and_marks_it_Sent()
    {
        var row = await AddRowAsync();
        var dispatcher = new SucceedingDispatcher("msg-123");

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Sent, reloaded.Status);
        Assert.Equal("msg-123", reloaded.ProviderMessageId);
        Assert.Equal(1, reloaded.Attempts);
        Assert.NotNull(reloaded.SentAt);
        Assert.Null(reloaded.LockedUntil);
        Assert.Equal(1, dispatcher.Calls);
    }

    [Fact]
    public async Task ProcessDueAsync_schedules_a_retry_after_a_retryable_failure()
    {
        // A whole-second timestamp, not DateTimeOffset.UtcNow: MySQL's datetime(6) column only keeps
        // microsecond precision, and comparing a round-tripped value against an in-memory one with
        // finer (sub-microsecond) ticks would be a flaky, truncation-dependent assertion.
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
        // The "due" query compares NextAttemptAt against the processor's own clock, so the row has to
        // be due by that same clock, not by the real wall-clock AddRowAsync defaults to.
        var row = await AddRowAsync(nextAttemptAt: time.Now.UtcDateTime.AddMinutes(-1));

        await OutboxProcessor(new FixedOutcomeDispatcher(EmailOutcome.Retry, "smtp_transient"), time).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Pending, reloaded.Status);
        Assert.Equal(1, reloaded.Attempts);
        Assert.Equal("smtp_transient", reloaded.LastError);
        Assert.Equal(time.Now.UtcDateTime + EmailOutboxProcessor.RetryDelays[0], reloaded.NextAttemptAt);
    }

    [Fact]
    public async Task ProcessDueAsync_fails_permanently_without_scheduling_a_retry()
    {
        var row = await AddRowAsync();

        await OutboxProcessor(new FixedOutcomeDispatcher(EmailOutcome.Permanent, "smtp_auth_failed")).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Failed, reloaded.Status);
        Assert.Equal(1, reloaded.Attempts);
        Assert.Equal("smtp_auth_failed", reloaded.LastError);
    }

    [Fact]
    public async Task ProcessDueAsync_gives_up_once_every_retry_delay_is_exhausted()
    {
        // Three prior failed attempts already used up every entry in RetryDelays, so this run is the
        // (RetryDelays.Length + 1)th, so it should give up rather than schedule yet another retry.
        var row = await AddRowAsync(attempts: EmailOutboxProcessor.RetryDelays.Length);
        var dispatcher = new FixedOutcomeDispatcher(EmailOutcome.Retry);

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Failed, reloaded.Status);
        Assert.Equal(EmailOutboxProcessor.RetryDelays.Length + 1, reloaded.Attempts);
    }

    [Fact]
    public async Task ProcessDueAsync_recovers_a_stale_Sending_row_left_by_a_crashed_worker()
    {
        var row = await AddRowAsync(
            status: OutboundEmailStatus.Sending, lockedUntil: DateTime.UtcNow.AddMinutes(-5));
        var dispatcher = new SucceedingDispatcher();

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Sent, reloaded.Status);
        Assert.Equal(1, dispatcher.Calls);
    }

    [Fact]
    public async Task ProcessDueAsync_does_not_resend_an_email_that_is_already_Sent()
    {
        var row = await AddRowAsync();
        var dispatcher = new SucceedingDispatcher();
        var processor = OutboxProcessor(dispatcher);

        await processor.ProcessDueAsync();
        await processor.ProcessDueAsync(); // a second poll cycle, as the real worker would run

        Assert.Equal(1, dispatcher.Calls);
        Assert.Equal(OutboundEmailStatus.Sent, (await ReloadAsync(row.Id)).Status);
    }

    [Fact]
    public async Task ProcessDueAsync_ignores_a_pending_email_whose_next_attempt_is_still_in_the_future()
    {
        var row = await AddRowAsync(nextAttemptAt: DateTime.UtcNow.AddMinutes(10));
        var dispatcher = new SucceedingDispatcher();

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        Assert.Equal(0, dispatcher.Calls);
        Assert.Equal(OutboundEmailStatus.Pending, (await ReloadAsync(row.Id)).Status);
    }

    // ----- Status-check-before-resend (an Ambiguous outcome recovering via the HTTP API provider) -----

    [Fact]
    public async Task ProcessDueAsync_marks_Sent_when_the_status_check_confirms_delivery()
    {
        var row = await AddRowAsync(needsStatusCheck: true);
        var dispatcher = new StatusCheckDispatcher(EmailApiDeliveryStatus.Sent, "already-sent-msg");

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Sent, reloaded.Status);
        Assert.Equal("already-sent-msg", reloaded.ProviderMessageId);
        Assert.False(reloaded.NeedsStatusCheck);
        Assert.Equal(0, dispatcher.SendCalls); // confirmed already sent: never resent
    }

    [Fact]
    public async Task ProcessDueAsync_resends_when_the_status_check_confirms_it_never_arrived()
    {
        var row = await AddRowAsync(needsStatusCheck: true);
        var dispatcher = new StatusCheckDispatcher(EmailApiDeliveryStatus.NotFound);

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Sent, reloaded.Status); // the resend (via SendAsync) succeeded
        Assert.Equal(1, dispatcher.SendCalls);
    }

    [Fact]
    public async Task ProcessDueAsync_resends_when_the_status_check_confirms_it_failed()
    {
        var row = await AddRowAsync(needsStatusCheck: true);
        var dispatcher = new StatusCheckDispatcher(EmailApiDeliveryStatus.Failed);

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        Assert.Equal(1, dispatcher.SendCalls);
    }

    [Fact]
    public async Task ProcessDueAsync_reschedules_another_check_while_the_status_is_still_pending()
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
        var row = await AddRowAsync(needsStatusCheck: true, nextAttemptAt: time.Now.UtcDateTime.AddMinutes(-1));
        var dispatcher = new StatusCheckDispatcher(EmailApiDeliveryStatus.Pending);

        await OutboxProcessor(dispatcher, time).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Pending, reloaded.Status);
        Assert.True(reloaded.NeedsStatusCheck);
        Assert.Equal(0, dispatcher.SendCalls);
        Assert.Equal(time.Now.UtcDateTime.AddMinutes(5), reloaded.NextAttemptAt);
    }

    [Fact]
    public async Task ProcessDueAsync_marks_Unknown_when_the_provider_cannot_answer_the_status_check()
    {
        var row = await AddRowAsync(needsStatusCheck: true);
        var dispatcher = new StatusCheckDispatcher(EmailApiDeliveryStatus.Unsupported);

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Unknown, reloaded.Status);
        Assert.False(reloaded.NeedsStatusCheck);
        Assert.Equal(0, dispatcher.SendCalls); // never guesses: left for an admin to resend by hand
    }

    [Fact]
    public async Task ProcessDueAsync_marks_Unknown_rather_than_crash_when_the_status_check_itself_throws()
    {
        var row = await AddRowAsync(needsStatusCheck: true);
        var dispatcher = new ThrowingStatusCheckDispatcher();

        await OutboxProcessor(dispatcher).ProcessDueAsync();

        var reloaded = await ReloadAsync(row.Id);
        Assert.Equal(OutboundEmailStatus.Unknown, reloaded.Status);
        Assert.False(reloaded.NeedsStatusCheck);
        Assert.Null(reloaded.LockedUntil);
        Assert.Equal(0, dispatcher.SendCalls);
    }

    [Fact]
    public async Task PurgeOldAsync_removes_only_old_terminal_rows()
    {
        var now = DateTime.UtcNow;
        var old = await AddRowAsync(status: OutboundEmailStatus.Sent, updatedAt: now.AddDays(-40));
        var recent = await AddRowAsync(status: OutboundEmailStatus.Failed, updatedAt: now.AddDays(-1));
        var oldButPending = await AddRowAsync(status: OutboundEmailStatus.Pending, updatedAt: now.AddDays(-40));

        await OutboxProcessor(time: new FakeTimeProvider(now)).PurgeOldAsync(TimeSpan.FromDays(30));

        Assert.False(await Db.OutboundEmails.AnyAsync(e => e.Id == old.Id));
        Assert.True(await Db.OutboundEmails.AnyAsync(e => e.Id == recent.Id));
        Assert.True(await Db.OutboundEmails.AnyAsync(e => e.Id == oldButPending.Id));
    }
}
