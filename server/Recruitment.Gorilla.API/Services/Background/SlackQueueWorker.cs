using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Services.Background;

public class SlackQueueWorker(
    ISlackQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<SlackQueueWorker> logger) : BackgroundService
{
    private const int MaxRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Slack background queue worker started.");

        try
        {
            await foreach (var job in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var slackService = scope.ServiceProvider.GetRequiredService<SlackService>();

                    await slackService.SendDirectAsync(job.ToEmail, job.Text);
                    logger.LogInformation("Successfully sent Slack DM to {ToEmail}.", job.ToEmail);
                }
                catch (SlackApiException ex)
                {
                    if (ex.IsTransient && job.RetryCount < MaxRetries && !stoppingToken.IsCancellationRequested)
                    {
                        var nextRetry = job.RetryCount + 1;
                        var delay = ex.RetryAfter ?? TimeSpan.FromSeconds(Math.Pow(2, job.RetryCount));
                        logger.LogWarning(ex, "Failed to send Slack DM to {ToEmail} ({Code}). Retrying ({Retry}/{Max}) in {Delay}s...",
                            job.ToEmail, ex.Code, nextRetry, MaxRetries, delay.TotalSeconds);

                        _ = Task.Run(async () =>
                        {
                            await Task.Delay(delay, stoppingToken);
                            await queue.QueueAsync(job with { RetryCount = nextRetry }, stoppingToken);
                        }, stoppingToken);
                    }
                    else if (ex.Code == "users_not_found")
                    {
                        // Not an error — the recipient just isn't in the Slack workspace.
                        logger.LogInformation("Skipping Slack DM to {ToEmail}: not found in the Slack workspace.", job.ToEmail);
                    }
                    else if (ex.IsTransient)
                    {
                        logger.LogError(ex, "Permanent failure sending Slack DM to {ToEmail} after {Max} retries ({Code}).",
                            job.ToEmail, MaxRetries, ex.Code);
                    }
                    else
                    {
                        logger.LogWarning(ex, "Permanent failure sending Slack DM to {ToEmail} ({Code}).", job.ToEmail, ex.Code);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Unexpected failure sending Slack DM to {ToEmail}.", job.ToEmail);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown
        }

        logger.LogInformation("Slack background queue worker stopped.");
    }
}
