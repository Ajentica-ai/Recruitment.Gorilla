using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Recruitment.Gorilla.API.Hubs;

[Authorize]
public class CVUploadHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnConnectedAsync();
    }

    public async Task JoinBatchGroup(string batchId)
    {
        if (!string.IsNullOrWhiteSpace(batchId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"batch_{batchId}");
        }
    }
}
