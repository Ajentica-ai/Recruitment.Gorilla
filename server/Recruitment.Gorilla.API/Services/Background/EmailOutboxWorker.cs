namespace Recruitment.Gorilla.API.Services.Background;

/// <summary>
/// Drives the email outbox: wakes on a signal from <see cref="EmailService.SendAsync"/> (the fast path
/// for a freshly queued email) or every 30 seconds regardless — so a scheduled retry, or anything the
/// signal missed (a worker that was mid-cycle when it fired), still gets picked up — then asks
/// <see cref="EmailOutboxProcessor"/> to send whatever is due. Runs the hourly purge of old terminal
/// rows from the same loop, the way <c>AuditLogBatchWorker</c> interleaves its own housekeeping.
/// </summary>
public class EmailOutboxWorker(
    IEmailOutboxSignal signal,
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<EmailOutboxWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan PurgeInterval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Email outbox worker started.");

        var retention = TimeSpan.FromDays(config.GetValue<int?>("EmailOutbox:RetentionDays") ?? 30);
        var nextPurge = DateTime.UtcNow + PurgeInterval;

        using var timer = new PeriodicTimer(PollInterval);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await ProcessOnceAsync(stoppingToken);

                if (DateTime.UtcNow >= nextPurge)
                {
                    await PurgeOnceAsync(retention, stoppingToken);
                    nextPurge = DateTime.UtcNow + PurgeInterval;
                }

                // Wake on whichever comes first: a fresh signal, or the regular poll tick.
                var signalTask = signal.WaitAsync(stoppingToken).AsTask();
                var timerTask = timer.WaitForNextTickAsync(stoppingToken).AsTask();
                await Task.WhenAny(signalTask, timerTask);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown
        }

        logger.LogInformation("Email outbox worker stopped.");
    }

    private async Task ProcessOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
            await processor.ProcessDueAsync(ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Error occurred while processing the email outbox.");
        }
    }

    private async Task PurgeOnceAsync(TimeSpan retention, CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
            await processor.PurgeOldAsync(retention, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Error occurred while purging old outbox rows.");
        }
    }
}
