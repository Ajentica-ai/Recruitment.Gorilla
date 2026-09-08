using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services.Background;

public class AuditLogBatchWorker(
    IAuditLogQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<AuditLogBatchWorker> logger) : BackgroundService
{
    private const int BatchSize = 50;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromMilliseconds(500);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Audit log background batch worker started.");

        var buffer = new List<AuditLog>(BatchSize);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
                    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, timeoutCts.Token);

                    try
                    {
                        if (await queue.WaitToReadAsync(linkedCts.Token))
                        {
                            while (buffer.Count < BatchSize && queue.TryRead(out var item))
                            {
                                buffer.Add(item);
                            }

                            if (buffer.Count > 0)
                            {
                                await FlushBatchAsync(buffer);
                            }
                        }
                    }
                    catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested && !stoppingToken.IsCancellationRequested)
                    {
                        if (buffer.Count > 0)
                        {
                            await FlushBatchAsync(buffer);
                        }
                    }
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogWarning(ex, "Error occurred in audit log batch worker loop.");
                    await Task.Delay(50, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown
        }

        // Final graceful flush on shutdown: drain remaining items from queue and buffer
        while (queue.TryRead(out var remaining))
        {
            buffer.Add(remaining);
        }

        if (buffer.Count > 0)
        {
            await FlushBatchAsync(buffer);
        }

        logger.LogInformation("Audit log background batch worker stopped.");
    }

    private async Task FlushBatchAsync(List<AuditLog> buffer)
    {
        if (buffer.Count == 0) return;

        var itemsToFlush = buffer.ToList();
        buffer.Clear();

        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            db.AuditLogs.AddRange(itemsToFlush);
            await db.SaveChangesAsync();

            logger.LogDebug("Flushed batch of {Count} audit log entries.", itemsToFlush.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to persist batch of {Count} audit log entries.", itemsToFlush.Count);
        }
    }
}
