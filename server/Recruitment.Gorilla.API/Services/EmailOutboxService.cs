using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services.Background;

namespace Recruitment.Gorilla.API.Services;

/// <summary>
/// Read/write access to the email delivery log for the admin control panel (SuperAdmin). Never
/// returns the HTML body (it can contain account details), only the metadata needed to see what was
/// sent, to whom, and whether it worked.
/// </summary>
public class EmailOutboxService(AppDbContext db, AuditService audit, IEmailOutboxSignal? signal = null)
{
    public async Task<PagedResult<OutboundEmailDto>> QueryAsync(string? status, int page, int pageSize)
    {
        var query = db.OutboundEmails.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(e => e.Status == status);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new OutboundEmailDto(
                e.Id, e.ToEmail, e.ToName, e.Subject, e.Status, e.Provider, e.Attempts,
                e.LastError, e.ProviderMessageId, e.NextAttemptAt, e.CreatedAt, e.SentAt, e.UpdatedAt))
            .ToListAsync();

        return new PagedResult<OutboundEmailDto>(items, total, page, pageSize);
    }

    /// <summary>
    /// Puts a Failed/Unknown row back at the front of the queue. Keeps the same <c>Reference</c>, so a
    /// provider that recognises an idempotency key won't double-send if the original attempt actually
    /// went through after all.
    /// </summary>
    public async Task<(bool Ok, bool NotFound, string? Error)> ResendAsync(long id)
    {
        var row = await db.OutboundEmails.FirstOrDefaultAsync(e => e.Id == id);
        if (row is null) return (false, true, null);
        if (row.Status != OutboundEmailStatus.Failed && row.Status != OutboundEmailStatus.Unknown)
            return (false, false, $"Only a Failed or Unknown email can be resent (this one is {row.Status}).");

        row.Status = OutboundEmailStatus.Pending;
        row.NextAttemptAt = DateTime.UtcNow;
        row.LastError = null;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        signal?.Notify();

        // OutboundEmail.Id is a bigint but AuditLog.EntityId is only int, so EntityId is left null
        // (it's a rarely-filtered-on convenience field, not the source of truth) and the id is kept
        // in Summary instead: no cast, so no overflow risk at any row count, however large.
        await audit.RecordAsync("Email.Resent", "OutboundEmail", entityId: null, summary: $"Resent email to {row.ToEmail} (#{row.Id})");
        return (true, false, null);
    }
}
