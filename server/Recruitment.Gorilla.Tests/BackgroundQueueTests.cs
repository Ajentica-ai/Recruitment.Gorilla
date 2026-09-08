using Microsoft.Extensions.DependencyInjection;
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
    public async Task EmailQueue_EnqueuesAndWorkerProcessesSuccessfully()
    {
        var queue = new EmailQueue(100);
        var fakeTransport = new CapturingSmtpTransport();
        var emailService = new EmailService(
            new FixedEmailSettingsResolver(new SmtpOptions { Host = "smtp.test.local", FromAddress = "test@test.local" }),
            fakeTransport,
            NullLogger<EmailService>.Instance,
            queue);

        var services = new ServiceCollection();
        services.AddSingleton(emailService);
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        var worker = new EmailQueueWorker(queue, scopeFactory, NullLogger<EmailQueueWorker>.Instance);

        using var cts = new CancellationTokenSource();
        var workerTask = worker.StartAsync(cts.Token);

        // Enqueue email via EmailService
        await emailService.SendAsync("candidate@example.com", "John Doe", "Interview Scheduled", "<p>Hello</p>");

        // Wait briefly for worker to consume
        await Task.Delay(200);

        await cts.CancelAsync();
        await worker.StopAsync(CancellationToken.None);

        Assert.Single(fakeTransport.SentMessages);
        Assert.Equal("Interview Scheduled", fakeTransport.SentMessages[0].Subject);
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
}

internal sealed class CapturingSmtpTransport : ISmtpTransport
{
    public List<MimeMessage> SentMessages { get; } = [];

    public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default)
    {
        SentMessages.Add(message);
        return Task.CompletedTask;
    }
}
