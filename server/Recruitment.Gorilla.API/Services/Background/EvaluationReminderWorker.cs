using Microsoft.Extensions.Options;

namespace Recruitment.Gorilla.API.Services.Background;

/// <summary>
/// Looks for overdue evaluations on a timer and hands them to <see cref="EvaluationReminderService"/> (#202). A failed
/// pass is logged and the next tick tries again: this worker must never take the host down, which
/// <c>HostOptions.BackgroundServiceExceptionBehavior</c> would otherwise do on an unhandled exception.
/// </summary>
public class EvaluationReminderWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<EvaluationReminderOptions> options,
    ILogger<EvaluationReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Evaluation reminders are switched off.");
            return;
        }

        logger.LogInformation("Evaluation reminder worker started (every {Minutes} min).", settings.PollMinutes);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, settings.PollMinutes)));

        try
        {
            do
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<EvaluationReminderService>();
                    var sent = await service.SendDueAsync(DateTime.UtcNow);
                    if (sent > 0) logger.LogInformation("Sent {Count} evaluation reminder(s).", sent);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    logger.LogError(ex, "Evaluation reminder pass failed; will retry on the next tick.");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
