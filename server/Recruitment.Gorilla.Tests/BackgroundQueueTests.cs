using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.API.Services.Background;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

[Collection(MySqlCollection.Name)]
public class BackgroundQueueTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    [Fact]
    public async Task EmailOutboxWorker_processes_a_queued_email_via_the_signal()
    {
        var signal = new EmailOutboxSignal();
        var fakeDispatcher = new CapturingDispatcher();
        var emailService = new EmailService(
            Db,
            new EmailDispatcher(
                new FixedEmailSettingsResolver(new SmtpOptions { Host = "smtp.test.local", FromAddress = "test@test.local" }),
                new NoOpSmtpTransport()),
            NullLogger<EmailService>.Instance,
            signal);

        // The worker opens its own scope per cycle: registering this test's transactional Db as the
        // resolved AppDbContext is what lets it see the (uncommitted, rolled-back-on-dispose) row this
        // test writes, the same trick BackgroundQueueTests already uses for the audit log worker below.
        var services = new ServiceCollection();
        services.AddSingleton(Db);
        services.AddSingleton<IEmailDispatcher>(fakeDispatcher);
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<ILogger<EmailOutboxProcessor>>(NullLogger<EmailOutboxProcessor>.Instance);
        services.AddScoped<EmailOutboxProcessor>();
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        var worker = new EmailOutboxWorker(
            signal, scopeFactory, new ConfigurationBuilder().Build(), NullLogger<EmailOutboxWorker>.Instance);

        using var cts = new CancellationTokenSource();
        var workerTask = worker.StartAsync(cts.Token);

        await emailService.SendAsync("candidate@example.com", "John Doe", "Interview Scheduled", "<p>Hello</p>");

        // Wait briefly for worker to consume
        await Task.Delay(200);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.Single(fakeDispatcher.Sent);
        Assert.Equal("Interview Scheduled", fakeDispatcher.Sent[0].Subject);

        var row = await Db.OutboundEmails.SingleAsync(e => e.ToEmail == "candidate@example.com");
        Assert.Equal(OutboundEmailStatus.Sent, row.Status);
    }

    [Fact]
    public async Task AuditLogBatchWorker_FlushesEntriesToDatabase()
    {
        var queue = new AuditLogQueue(500);

        var services = new ServiceCollection();
        services.AddSingleton(Db);
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        var worker = new AuditLogBatchWorker(queue, scopeFactory, NullLogger<AuditLogBatchWorker>.Instance);

        using var cts = new CancellationTokenSource();
        var workerTask = worker.StartAsync(cts.Token);

        // Enqueue 3 audit entries
        var actionName = $"AsyncTestAction-{Guid.NewGuid():N}";
        await queue.QueueAsync(new AuditLog
        {
            Action = actionName,
            ActorName = "System",
            Timestamp = DateTime.UtcNow,
        });

        // Trigger graceful shutdown to flush
        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        var count = Db.AuditLogs.Count(a => a.Action == actionName);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task SlackQueue_EnqueuesAndWorkerProcessesSuccessfully()
    {
        var queue = new SlackQueue(100);
        var transport = new ScriptedSlackTransport(_ => null);
        var slackService = new SlackService(
            new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned),
            transport, TestConfig(), NullLogger<SlackService>.Instance, queue);

        var worker = new SlackQueueWorker(queue, BuildScopeFactory(slackService), NullLogger<SlackQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await slackService.EnqueueAsync(NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Body", null);
        await Task.Delay(200);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.Single(transport.PostedTexts);
    }

    [Fact]
    public async Task SlackQueueWorker_retries_a_transient_failure_then_succeeds()
    {
        var queue = new SlackQueue(100);
        // Rate-limited on the first lookup attempt, then succeeds — Slack's documented retry contract.
        var transport = new ScriptedSlackTransport(attempt => attempt == 1
            ? new SlackApiException("ratelimited", isTransient: true, retryAfter: TimeSpan.FromMilliseconds(100))
            : null);
        var slackService = new SlackService(
            new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned),
            transport, TestConfig(), NullLogger<SlackService>.Instance, queue);

        var worker = new SlackQueueWorker(queue, BuildScopeFactory(slackService), NullLogger<SlackQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await slackService.EnqueueAsync(NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Body", null);
        await Task.Delay(500); // first attempt + ~100ms retry-after + the retry itself

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(2, transport.Attempts);
        Assert.Single(transport.PostedTexts);
    }

    [Fact]
    public async Task SlackQueueWorker_does_not_retry_a_permanent_failure()
    {
        var queue = new SlackQueue(100);
        var transport = new ScriptedSlackTransport(_ => new SlackApiException("invalid_auth", isTransient: false));
        var slackService = new SlackService(
            new FakeSlackSettingsResolver("xoxb-test", NotificationCategories.InterviewAssigned),
            transport, TestConfig(), NullLogger<SlackService>.Instance, queue);

        var worker = new SlackQueueWorker(queue, BuildScopeFactory(slackService), NullLogger<SlackQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        await worker.StartAsync(cts.Token);

        await slackService.EnqueueAsync(NotificationCategories.InterviewAssigned, "a@b.com", "Title", "Body", null);
        await Task.Delay(300);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.Equal(1, transport.Attempts);
        Assert.Empty(transport.PostedTexts);
    }

    private static IServiceScopeFactory BuildScopeFactory(SlackService slackService)
    {
        var services = new ServiceCollection();
        services.AddSingleton(slackService);
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }
}

/// <summary>Records every email the outbox processor hands it, without touching the network.</summary>
internal sealed class CapturingDispatcher : IEmailDispatcher
{
    public List<EmailSendRequest> Sent { get; } = [];

    public Task<string?> SendAsync(EmailSendRequest request, CancellationToken ct = default)
    {
        Sent.Add(request);
        return Task.FromResult<string?>(null);
    }
}

/// <summary>
/// A fake Slack transport whose users.lookupByEmail call is scripted per attempt (1-based), so tests
/// can force a transient failure on the first try and success on the retry, or a permanent failure
/// that should never be retried.
/// </summary>
internal sealed class ScriptedSlackTransport(Func<int, Exception?> onLookupAttempt) : ISlackTransport
{
    public int Attempts;
    public List<string> PostedTexts { get; } = [];

    public Task<JsonElement> CallAsync(
        string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default)
    {
        if (method == "users.lookupByEmail")
        {
            Attempts++;
            if (onLookupAttempt(Attempts) is { } ex) throw ex;
            return Task.FromResult(JsonDocument.Parse("""{"ok":true,"user":{"id":"U1"}}""").RootElement);
        }

        PostedTexts.Add(form["text"]);
        return Task.FromResult(JsonDocument.Parse("""{"ok":true}""").RootElement);
    }
}
