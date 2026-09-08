namespace Recruitment.Gorilla.API.Services.Background;

public class EmailQueueWorker(
    IEmailQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<EmailQueueWorker> logger) : BackgroundService
{
    private const int MaxRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Email background queue worker started.");

        try
        {
            await foreach (var job in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var emailService = scope.ServiceProvider.GetRequiredService<EmailService>();

                    await emailService.SendDirectAsync(job.ToEmail, job.ToName, job.Subject, job.HtmlBody, job.Calendar);
                    logger.LogInformation("Successfully sent email to {ToEmail} for subject '{Subject}'.", job.ToEmail, job.Subject);
                }
                catch (Exception ex)
                {
                    if (job.RetryCount < MaxRetries && !stoppingToken.IsCancellationRequested)
                    {
                        var nextRetry = job.RetryCount + 1;
                        var delay = TimeSpan.FromSeconds(Math.Pow(2, job.RetryCount));
                        logger.LogWarning(ex, "Failed to send email to {ToEmail}. Retrying ({Retry}/{Max}) in {Delay}s...",
                            job.ToEmail, nextRetry, MaxRetries, delay.TotalSeconds);

                        _ = Task.Run(async () =>
                        {
                            await Task.Delay(delay, stoppingToken);
                            await queue.QueueAsync(job with { RetryCount = nextRetry }, stoppingToken);
                        }, stoppingToken);
                    }
                    else
                    {
                        logger.LogError(ex, "Permanent failure sending email to {ToEmail} for subject '{Subject}'.",
                            job.ToEmail, job.Subject);
                    }
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown
        }

        logger.LogInformation("Email background queue worker stopped.");
    }
}
