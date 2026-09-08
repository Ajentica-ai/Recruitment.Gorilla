using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize(Roles = Roles.CanWriteCandidate)]
[Route("api/candidate-drafts")]
public class CandidateDraftsController(CandidateDraftService draftService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedDraftsResultDto>> GetDrafts([FromQuery] DraftsFilterQuery query)
    {
        var result = await draftService.GetDraftsAsync(query);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CandidateDraftDto>> GetById(int id)
    {
        var draft = await draftService.GetDraftByIdAsync(id);
        if (draft == null) return NotFound($"Candidate draft #{id} not found.");
        return Ok(draft);
    }

    [HttpGet("batches")]
    public async Task<ActionResult<List<DraftBatchSummaryDto>>> GetBatches()
    {
        var batches = await draftService.GetBatchesAsync();
        return Ok(batches);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CandidateDraftDto>> Update(int id, [FromBody] UpdateCandidateDraftDto dto)
    {
        var updated = await draftService.UpdateDraftAsync(id, dto);
        if (updated == null) return NotFound($"Candidate draft #{id} not found.");
        return Ok(updated);
    }

    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveCandidateDraftDto dto)
    {
        var (candidate, error) = await draftService.ApproveDraftAsync(id, dto);
        if (error != null) return BadRequest(error);
        return Ok(new { candidateId = candidate!.Id, message = $"Successfully created candidate '{candidate.FullName}'." });
    }

    [HttpPost("bulk-approve")]
    public async Task<IActionResult> BulkApprove([FromBody] BulkApproveDraftsDto dto)
    {
        if (dto.DraftIds is null or { Count: 0 })
            return BadRequest("At least one draft ID must be provided.");

        var candidateIds = await draftService.BulkApproveAsync(dto);
        return Ok(new { approvedCount = candidateIds.Count, candidateIds });
    }

    [HttpPost("{id:int}/discard")]
    public async Task<IActionResult> Discard(int id)
    {
        var success = await draftService.DiscardDraftAsync(id);
        if (!success) return NotFound($"Candidate draft #{id} not found.");
        return Ok(new { message = $"Draft #{id} marked as discarded." });
    }

    [HttpPost("bulk-discard")]
    public async Task<IActionResult> BulkDiscard([FromBody] BulkDiscardDraftsDto dto)
    {
        if (dto.DraftIds is null or { Count: 0 })
            return BadRequest("At least one draft ID must be provided.");

        var discardedCount = await draftService.BulkDiscardAsync(dto.DraftIds);
        return Ok(new { discardedCount });
    }
}
