using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services.Background;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Writes and queries the append-only <see cref="AuditLog"/> ("who changed what, when"). Recording is
/// best-effort — a failure to write an audit row is logged but never breaks the underlying operation.
/// When <see cref="IAuditLogQueue"/> is registered, writes are buffered asynchronously.
/// </summary>
public class AuditService(
    AppDbContext db,
    CurrentUser currentUser,
    ILogger<AuditService> logger,
    IAuditLogQueue? queue = null)
{
    /// <summary>Records an action attributed to the current authenticated user.</summary>
    public Task RecordAsync(
        string action, string? entityType = null, int? entityId = null, string? summary = null, string? details = null) =>
        RecordAsync(action, currentUser.UserId, currentUser.Name, entityType, entityId, summary, details);

    /// <summary>Records an action with an explicit actor (for auth events where the request is anonymous).</summary>
    public async Task RecordAsync(
        string action, int? actorUserId, string? actorName,
        string? entityType = null, int? entityId = null, string? summary = null, string? details = null)
    {
        try
        {
            var entry = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                ActorUserId = actorUserId,
                ActorName = string.IsNullOrWhiteSpace(actorName) ? "Unknown" : actorName,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Summary = summary,
                Details = details,
            };

            if (queue != null)
            {
                await queue.QueueAsync(entry);
            }
            else
            {
                db.AuditLogs.Add(entry);
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to write audit log entry for action {Action}.", action);
        }
    }

    public async Task<PagedResult<AuditLogDto>> QueryAsync(
        int? actorUserId, string? entityType, int? entityId, string? action,
        DateTime? from, DateTime? to, int page, int pageSize)
    {
        var query = db.AuditLogs.AsQueryable();

        if (actorUserId is int uid) query = query.Where(a => a.ActorUserId == uid);
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(a => a.EntityType == entityType);
        if (entityId is int eid) query = query.Where(a => a.EntityId == eid);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.Contains(action));
        if (from is DateTime f) query = query.Where(a => a.Timestamp >= f);
        if (to is DateTime t) query = query.Where(a => a.Timestamp <= t);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Timestamp).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto(
                a.Id, a.Timestamp, a.ActorUserId, a.ActorName, a.Action,
                a.EntityType, a.EntityId, a.Summary, a.Details))
            .ToListAsync();

        return new PagedResult<AuditLogDto>(items, total, page, pageSize);
    }
}
