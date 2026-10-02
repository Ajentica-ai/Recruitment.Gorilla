using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.API.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class OffersController(
    OfferService offerService,
    CurrentUser currentUser,
    ILogger<OffersController> logger) : ControllerBase
{
    private int? OwnerScope =>
        currentUser.IsInAnyRole(Roles.SuperAdmin, Roles.Admin) ? null : currentUser.UserId;

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("candidates/{candidateId}/offers")]
    public async Task<IActionResult> GetCandidateOffers(int candidateId)
    {
        var offers = await offerService.GetOffersByCandidateAsync(candidateId, OwnerScope);
        return Ok(offers);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("candidates/{candidateId}/offers/{offerId}")]
    public async Task<IActionResult> GetOfferById(int candidateId, int offerId)
    {
        var offer = await offerService.GetOfferByIdAsync(offerId, OwnerScope);
        if (offer is null || offer.CandidateId != candidateId)
            return NotFound();

        return Ok(offer);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("candidates/{candidateId}/offers")]
    public async Task<IActionResult> CreateOffer(int candidateId, [FromBody] CreateOfferDto dto)
    {
        if (dto.BaseSalary <= 0)
            return BadRequest("Base salary must be greater than zero.");

        var created = await offerService.CreateOfferAsync(
            candidateId,
            dto,
            OwnerScope,
            currentUser.UserId ?? 0,
            currentUser.Name ?? string.Empty);

        if (created is null)
            return NotFound("Candidate not found or access denied.");

        return CreatedAtAction(nameof(GetOfferById), new { candidateId, offerId = created.Id }, created);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPut("candidates/{candidateId}/offers/{offerId}")]
    public async Task<IActionResult> UpdateOffer(int candidateId, int offerId, [FromBody] UpdateOfferDto dto)
    {
        if (dto.BaseSalary <= 0)
            return BadRequest("Base salary must be greater than zero.");

        var updated = await offerService.UpdateOfferAsync(
            offerId,
            dto,
            OwnerScope,
            currentUser.UserId ?? 0,
            currentUser.Name ?? string.Empty);

        if (updated is null || updated.CandidateId != candidateId)
            return NotFound();

        return Ok(updated);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("candidates/{candidateId}/offers/{offerId}/submit-approval")]
    public async Task<IActionResult> SubmitForApproval(int candidateId, int offerId, [FromBody] List<int>? approverUserIds)
    {
        var submitted = await offerService.SubmitForApprovalAsync(
            offerId,
            approverUserIds,
            currentUser.UserId ?? 0,
            currentUser.Name ?? string.Empty,
            OwnerScope);

        if (submitted is null || submitted.CandidateId != candidateId)
            return NotFound();

        return Ok(submitted);
    }

    // Admin and above only. This used to be CanWriteCandidate, so any Recruiter, including one with no
    // candidates of their own, could approve or reject any offer by walking the sequential offer ids,
    // and could approve their own. The UI already offered Approve and Reject only to Admin and above.
    [Authorize(Roles = Roles.AdminOrAbove)]
    [HttpPost("candidates/{candidateId}/offers/{offerId}/review")]
    public async Task<IActionResult> ReviewApproval(int candidateId, int offerId, [FromBody] ReviewOfferApprovalDto dto)
    {
        if (!string.Equals(dto.Decision, "Approved", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(dto.Decision, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Decision must be 'Approved' or 'Rejected'.");
        }

        OfferDto? reviewed;
        try
        {
            reviewed = await offerService.ReviewApprovalAsync(
                offerId,
                candidateId,
                dto,
                currentUser.UserId ?? 0,
                currentUser.Name ?? string.Empty);
        }
        catch (InvalidOperationException ex)
        {
            // An offer that is not awaiting approval. A conflict with its current state, not a server
            // fault, so it is a 409 the client can show rather than a 500.
            return Conflict(ex.Message);
        }

        if (reviewed is null)
            return NotFound();

        return Ok(reviewed);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("candidates/{candidateId}/offers/{offerId}/extend")]
    public async Task<IActionResult> ExtendOffer(int candidateId, int offerId)
    {
        var extended = await offerService.ExtendOfferAsync(
            offerId,
            currentUser.UserId ?? 0,
            currentUser.Name ?? string.Empty,
            OwnerScope);

        if (extended is null || extended.CandidateId != candidateId)
            return NotFound();

        return Ok(extended);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpPost("candidates/{candidateId}/offers/{offerId}/decision")]
    public async Task<IActionResult> RecordDecision(int candidateId, int offerId, [FromBody] OfferDecisionDto dto)
    {
        if (!string.Equals(dto.Decision, "Accepted", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(dto.Decision, "Declined", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Decision must be 'Accepted' or 'Declined'.");
        }

        if (string.Equals(dto.Decision, "Declined", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(dto.Reason))
        {
            return BadRequest("A reason is required when an offer is declined.");
        }

        var decided = await offerService.RecordDecisionAsync(
            offerId,
            dto,
            currentUser.UserId ?? 0,
            currentUser.Name ?? string.Empty,
            OwnerScope);

        if (decided is null || decided.CandidateId != candidateId)
            return NotFound();

        return Ok(decided);
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("candidates/{candidateId}/offers/{offerId}/pdf")]
    public async Task<IActionResult> DownloadOfferLetterPdf(int candidateId, int offerId)
    {
        var pdfBytes = await offerService.GenerateOfferLetterPdfAsync(offerId, OwnerScope);
        if (pdfBytes is null)
            return NotFound();

        return File(pdfBytes, "application/pdf", $"Offer_Letter_Ref_{offerId:D5}.pdf");
    }

    [Authorize(Roles = Roles.CanWriteCandidate)]
    [HttpGet("offers/metrics")]
    public async Task<IActionResult> GetOfferMetrics()
    {
        var metrics = await offerService.GetMetricsAsync(OwnerScope);
        return Ok(metrics);
    }
}
