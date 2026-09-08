using Microsoft.AspNetCore.SignalR;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Hubs;

namespace Recruitment.Gorilla.API.Services;

public record CVUploadProgressEvent(
    string BatchId,
    int FileIndex,
    int TotalFiles,
    string FileName,
    string Status, // "queued", "parsing", "completed", "error"
    double Percent,
    CVDraftDto? Draft = null,
    string? Error = null
);

public interface ICVUploadProgressNotifier
{
    Task NotifyProgressAsync(string? userId, string? batchId, CVUploadProgressEvent progress);
}

public class CVUploadProgressNotifier(IHubContext<CVUploadHub> hubContext, ILogger<CVUploadProgressNotifier> logger)
    : ICVUploadProgressNotifier
{
    public async Task NotifyProgressAsync(string? userId, string? batchId, CVUploadProgressEvent progress)
    {
        try
        {
            if (!string.IsNullOrEmpty(batchId))
            {
                await hubContext.Clients.Group($"batch_{batchId}").SendAsync("OnUploadProgress", progress);
            }
            else if (!string.IsNullOrEmpty(userId))
            {
                await hubContext.Clients.Group($"user_{userId}").SendAsync("OnUploadProgress", progress);
            }
            else
            {
                await hubContext.Clients.All.SendAsync("OnUploadProgress", progress);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to broadcast upload progress via SignalR for file {FileName}.", progress.FileName);
        }
    }
}
