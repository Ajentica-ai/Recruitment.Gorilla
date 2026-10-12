using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;

namespace Recruitment.Gorilla.API.Services;

public class StatusOptionService(AppDbContext db, CandidateService candidateService)
{
    public async Task<List<StatusOptionDto>> GetActiveAsync() =>
        await db.StatusOptions
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .Select(s => new StatusOptionDto(s.Id, s.Name, s.SortOrder, s.IsInitial))
            .ToListAsync();

    public async Task<List<StatusOptionDto>> GetInitialAsync() =>
        await db.StatusOptions
            .Where(s => s.IsActive && s.IsInitial)
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .Select(s => new StatusOptionDto(s.Id, s.Name, s.SortOrder, s.IsInitial))
            .ToListAsync();

    /// <summary>
    /// The candidate's allowed next statuses, scoped the same way the candidate endpoints are:
    /// null when the candidate doesn't exist or <paramref name="ownerUserId"/> (a non-admin
    /// caller) can't access it, so an out-of-scope caller gets the same "not found" as
    /// <c>GET /api/candidates/{id}</c> rather than confirming the candidate exists.
    /// </summary>
    public async Task<List<StatusOptionDto>?> GetNextForCandidateAsync(int candidateId, int? ownerUserId = null)
    {
        var currentStatus = await candidateService.GetCurrentStatusIfAccessibleAsync(candidateId, ownerUserId);

        if (currentStatus is null) return null;

        return await db.StatusTransitions
            .Where(t =>
                t.IsActive &&
                t.FromStatusOption.IsActive &&
                t.ToStatusOption.IsActive &&
                t.FromStatusOption.Name == currentStatus)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.ToStatusOption.SortOrder)
            .Select(t => new StatusOptionDto(
                t.ToStatusOption.Id,
                t.ToStatusOption.Name,
                t.ToStatusOption.SortOrder,
                t.ToStatusOption.IsInitial))
            .ToListAsync();
    }
}
