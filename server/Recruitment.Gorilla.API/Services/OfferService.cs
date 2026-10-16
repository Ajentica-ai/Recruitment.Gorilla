using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class OfferService(
    AppDbContext db,
    CandidateService candidateService,
    NotificationService notificationService,
    AuditService audit,
    ILogger<OfferService> logger)
{
    static OfferService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static IQueryable<Candidate> ApplyCandidateAccess(IQueryable<Candidate> query, int? accessUserId) =>
        accessUserId is int uid
            ? query.Where(c => c.OwnerUserId == uid ||
                               (c.RoleAppliedOption != null &&
                                c.RoleAppliedOption.Recruiters.Any(rr => rr.UserId == uid)))
            : query;

    public async Task<List<OfferDto>> GetOffersByCandidateAsync(int candidateId, int? accessUserId)
    {
        var candidateExists = await ApplyCandidateAccess(db.Candidates.AsQueryable(), accessUserId)
            .AnyAsync(c => c.Id == candidateId);
        if (!candidateExists) return [];

        var offers = await db.Offers
            .Where(o => o.CandidateId == candidateId)
            .Include(o => o.Candidate)
            .Include(o => o.CreatedByUser)
            .Include(o => o.Approvals).ThenInclude(a => a.ApproverUser)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return offers.Select(MapToDto).ToList();
    }

    public async Task<OfferDto?> GetOfferByIdAsync(int offerId, int? accessUserId)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .Include(o => o.CreatedByUser)
            .Include(o => o.Approvals).ThenInclude(a => a.ApproverUser)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        return MapToDto(offer);
    }

    public async Task<OfferDto?> CreateOfferAsync(
        int candidateId, CreateOfferDto dto, int? accessUserId, int userId, string userName)
    {
        // Scoped like every sibling method, so an out-of-scope candidate reads as missing and the
        // controller's "not found or access denied" is finally true. Before this, a Recruiter could
        // raise an offer on any candidate by guessing its id, and so also push a Recommended one to
        // Offer Preparation and read its name and email back in the response.
        var candidate = await ApplyCandidateAccess(db.Candidates.Include(c => c.RoleAppliedOption), accessUserId)
            .FirstOrDefaultAsync(c => c.Id == candidateId);

        if (candidate is null) return null;

        var jobTitle = !string.IsNullOrWhiteSpace(dto.JobTitle)
            ? dto.JobTitle.Trim()
            : candidate.RoleAppliedOption?.Name ?? candidate.AppliedRole ?? "Job Position";

        var offer = new Offer
        {
            CandidateId = candidateId,
            JobTitle = jobTitle,
            BaseSalary = dto.BaseSalary,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpperInvariant(),
            Bonus = dto.Bonus,
            Equity = string.IsNullOrWhiteSpace(dto.Equity) ? null : dto.Equity.Trim(),
            StartDate = dto.StartDate,
            ExpirationDate = dto.ExpirationDate,
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
            Status = "Draft",
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Offers.Add(offer);
        await db.SaveChangesAsync();

        // If candidate is in Recommended, advance to Offer Preparation
        if (candidate.CurrentStatus == "Recommended")
        {
            await candidateService.AddStatusAsync(
                candidateId,
                new StatusChangeDto("Offer Preparation", "Offer drafted by recruiter"),
                userName,
                userId);
        }

        await audit.RecordAsync("Offer.Created", "Offer", offer.Id,
            $"Created draft offer of {offer.Currency} {offer.BaseSalary:N2} for '{candidate.FullName}' (Candidate #{candidateId})");

        return await GetOfferByIdAsync(offer.Id, accessUserId);
    }

    public async Task<OfferDto?> UpdateOfferAsync(int offerId, UpdateOfferDto dto, int? accessUserId, int userId, string userName)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        if (!string.IsNullOrWhiteSpace(dto.JobTitle))
            offer.JobTitle = dto.JobTitle.Trim();

        offer.BaseSalary = dto.BaseSalary;
        if (!string.IsNullOrWhiteSpace(dto.Currency))
            offer.Currency = dto.Currency.Trim().ToUpperInvariant();

        offer.Bonus = dto.Bonus;
        offer.Equity = string.IsNullOrWhiteSpace(dto.Equity) ? null : dto.Equity.Trim();
        offer.StartDate = dto.StartDate;
        offer.ExpirationDate = dto.ExpirationDate;
        offer.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
        offer.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        await audit.RecordAsync("Offer.Updated", "Offer", offer.Id,
            $"Updated offer terms for Candidate #{offer.CandidateId}");

        return await GetOfferByIdAsync(offer.Id, null);
    }

    public async Task<OfferDto?> SubmitForApprovalAsync(int offerId, List<int>? approverUserIds, int userId, string userName, int? accessUserId)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .Include(o => o.Approvals)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        offer.Status = "PendingApproval";
        offer.UpdatedAt = DateTime.UtcNow;

        // If specific approvers were provided, create approval records
        if (approverUserIds is { Count: > 0 })
        {
            // Only Admin and above can review an offer, so only they can be named as approvers. A
            // Recruiter or Interviewer named here would get a request they cannot act on, and their
            // Pending row would stop any Admin approval from ever moving the offer to Approved.
            var validApprovers = await db.Users
                .Where(u => approverUserIds.Contains(u.Id) && u.IsActive &&
                            u.Roles.Any(r => r.Role == Auth.Roles.Admin || r.Role == Auth.Roles.SuperAdmin))
                .ToListAsync();

            foreach (var approver in validApprovers)
            {
                if (!offer.Approvals.Any(a => a.ApproverUserId == approver.Id && a.Status == "Pending"))
                {
                    db.OfferApprovals.Add(new OfferApproval
                    {
                        OfferId = offer.Id,
                        ApproverUserId = approver.Id,
                        Status = "Pending",
                        CreatedAt = DateTime.UtcNow
                    });

                    await notificationService.NotifyAsync(
                        approver.Id,
                        "Offer Approval Requested",
                        $"{userName} requested your approval for an offer to {offer.Candidate.FullName} ({offer.JobTitle}).",
                        $"/candidates/{offer.CandidateId}");
                }
            }
        }

        await db.SaveChangesAsync();

        await audit.RecordAsync("Offer.SubmittedForApproval", "Offer", offer.Id,
            $"Submitted offer for approval for Candidate #{offer.CandidateId}");

        return await GetOfferByIdAsync(offer.Id, null);
    }

    /// <summary>
    /// Records an approver's decision on an offer awaiting approval.
    ///
    /// Who may call this is decided at the controller, which allows Admin and above only, matching the
    /// UI. That is also why the reviewer's approval row is still created on the fly: offers are
    /// submitted from the UI with no named approvers, so there is never a pre-assigned row to require,
    /// and requiring one would leave every offer unapprovable.
    /// </summary>
    public async Task<OfferDto?> ReviewApprovalAsync(
        int offerId, int candidateId, ReviewOfferApprovalDto dto, int approverUserId, string approverName)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate)
            .Include(o => o.Approvals)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        // Checked before anything is written. The controller used to compare the candidate id only
        // after SaveChangesAsync, so a mismatched URL still committed the review and its audit row.
        if (offer is null || offer.CandidateId != candidateId) return null;

        // Only an offer awaiting approval can be reviewed. Otherwise approving a Draft skips the submit
        // step entirely, and rejecting an Extended or Accepted offer knocks it back to Draft.
        if (offer.Status != "PendingApproval")
            throw new InvalidOperationException(
                $"Offer #{offerId} is '{offer.Status}', not awaiting approval, so it cannot be reviewed.");

        var isDecisionApproved = string.Equals(dto.Decision, "Approved", StringComparison.OrdinalIgnoreCase);

        var approval = offer.Approvals.FirstOrDefault(a => a.ApproverUserId == approverUserId && a.Status == "Pending")
            ?? new OfferApproval
            {
                OfferId = offer.Id,
                ApproverUserId = approverUserId,
                CreatedAt = DateTime.UtcNow
            };

        if (approval.Id == 0)
        {
            db.OfferApprovals.Add(approval);
        }

        approval.Status = isDecisionApproved ? "Approved" : "Rejected";
        approval.Comment = dto.Comment;
        approval.ReviewedAt = DateTime.UtcNow;

        if (isDecisionApproved)
        {
            // If all approvals are approved, mark offer approved
            var otherPending = offer.Approvals.Any(a => a != approval && a.Status == "Pending");
            if (!otherPending)
            {
                offer.Status = "Approved";
            }
        }
        else
        {
            offer.Status = "Draft"; // Returned to draft on rejection
        }

        offer.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await audit.RecordAsync("Offer.Reviewed", "Offer", offer.Id,
            $"{approverName} reviewed offer with decision '{approval.Status}' for Candidate #{offer.CandidateId}");

        return await GetOfferByIdAsync(offer.Id, null);
    }

    public async Task<OfferDto?> ExtendOfferAsync(int offerId, int userId, string userName, int? accessUserId)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        if (offer.Status is "Extended" or "Accepted" or "Declined")
        {
            throw new InvalidOperationException($"Offer #{offerId} cannot be extended because its status is already '{offer.Status}'. Create a new offer version first.");
        }

        offer.Status = "Extended";
        offer.ExtendedAt = DateTime.UtcNow;
        offer.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        // Advance candidate status to "Offer Extended"
        if (offer.Candidate.CurrentStatus != "Offer Extended")
        {
            await candidateService.AddStatusAsync(
                offer.CandidateId,
                new StatusChangeDto("Offer Extended", $"Offer of {offer.Currency} {offer.BaseSalary:N2} extended to candidate"),
                userName,
                userId);
        }

        await audit.RecordAsync("Offer.Extended", "Offer", offer.Id,
            $"Extended offer of {offer.Currency} {offer.BaseSalary:N2} to '{offer.Candidate.FullName}'");

        return await GetOfferByIdAsync(offer.Id, null);
    }

    public async Task<OfferDto?> RecordDecisionAsync(int offerId, OfferDecisionDto dto, int userId, string userName, int? accessUserId)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        if (offer.Status != "Extended")
        {
            throw new InvalidOperationException($"Cannot record decision on offer #{offerId} with status '{offer.Status}'. The offer must be in 'Extended' status.");
        }

        var isAccepted = string.Equals(dto.Decision, "Accepted", StringComparison.OrdinalIgnoreCase);

        offer.Status = isAccepted ? "Accepted" : "Declined";
        offer.RespondedAt = DateTime.UtcNow;
        offer.DeclineReason = isAccepted ? null : dto.Reason;
        offer.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        var newCandidateStatus = isAccepted ? "Offer Accepted" : "Offer Declined";
        var comment = isAccepted ? "Candidate accepted offer" : $"Candidate declined offer: {dto.Reason}";

        await candidateService.AddStatusAsync(
            offer.CandidateId,
            new StatusChangeDto(newCandidateStatus, comment),
            userName,
            userId);

        await audit.RecordAsync($"Offer.{offer.Status}", "Offer", offer.Id,
            $"Candidate decision recorded: '{offer.Status}' for '{offer.Candidate.FullName}'");

        return await GetOfferByIdAsync(offer.Id, null);
    }

    public async Task<byte[]?> GenerateOfferLetterPdfAsync(int offerId, int? accessUserId)
    {
        var offer = await db.Offers
            .Include(o => o.Candidate).ThenInclude(c => c.RoleAppliedOption).ThenInclude(r => r!.Recruiters)
            .FirstOrDefaultAsync(o => o.Id == offerId);

        if (offer is null) return null;

        if (accessUserId is int uid)
        {
            var isOwner = offer.Candidate.OwnerUserId == uid;
            var isAssignedRecruiter = offer.Candidate.RoleAppliedOption?.Recruiters.Any(rr => rr.UserId == uid) ?? false;
            if (!isOwner && !isAssignedRecruiter) return null;
        }

        var candidate = offer.Candidate;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                page.Header()
                    .Row(row =>
                    {
                        row.RelativeItem().Column(col =>
                        {
                            col.Item().Text("RECRUITMENT GORILLA").FontSize(20).Bold().FontColor("#1F4E79");
                            col.Item().Text("Official Offer of Employment").FontSize(12).FontColor("#595959");
                        });
                        row.ConstantItem(150).AlignRight().Column(col =>
                        {
                            col.Item().Text($"Date: {DateTime.UtcNow:MMMM dd, yyyy}").FontSize(10).FontColor("#595959");
                            col.Item().Text($"Offer Ref: #{offer.Id:D5}").FontSize(10).FontColor("#7F7F7F");
                        });
                    });

                page.Content()
                    .PaddingVertical(1, Unit.Centimetre)
                    .Column(col =>
                    {
                        col.Spacing(12);

                        col.Item().Text($"Dear {candidate.FullName},").Bold();
                        col.Item().Text($"We are thrilled to offer you the position of {offer.JobTitle} at Recruitment Gorilla. Our team was deeply impressed with your background, skills, and values during the interview process, and we are excited about the prospect of having you join us.");

                        col.Item().PaddingTop(10).Text("Summary of Offer Terms").Bold().FontSize(13).FontColor("#1F4E79");

                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(160);
                                columns.RelativeColumn();
                            });

                            table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Position Title").Bold();
                            table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text(offer.JobTitle);

                            table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Base Compensation").Bold();
                            table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text($"{offer.Currency} {offer.BaseSalary:N2} (gross per annum)");

                            if (offer.Bonus.HasValue && offer.Bonus.Value > 0)
                            {
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Bonus / Incentive").Bold();
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text($"{offer.Currency} {offer.Bonus.Value:N2}");
                            }

                            if (!string.IsNullOrWhiteSpace(offer.Equity))
                            {
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Equity / Stock Options").Bold();
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text(offer.Equity);
                            }

                            if (offer.StartDate.HasValue)
                            {
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Target Start Date").Bold();
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text(offer.StartDate.Value.ToString("MMMM dd, yyyy"));
                            }

                            if (offer.ExpirationDate.HasValue)
                            {
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text("Offer Expiration").Bold();
                                table.Cell().BorderBottom(1).BorderColor("#E0E0E0").Padding(6).Text(offer.ExpirationDate.Value.ToString("MMMM dd, yyyy"));
                            }
                        });

                        if (!string.IsNullOrWhiteSpace(offer.Notes))
                        {
                            col.Item().PaddingTop(4).Text("Additional Notes & Benefits:").Bold();
                            col.Item().Text(offer.Notes);
                        }

                        col.Item().PaddingTop(8).Text("This offer is contingent upon the standard completion of background checks and verification. To accept this offer, please sign and date this document below and return it to your recruiter.");

                        col.Item().PaddingTop(25).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("For Recruitment Gorilla:").Bold();
                                c.Item().PaddingTop(35).Text("_________________________________");
                                c.Item().Text("Authorized Hiring Manager / Recruiter");
                            });
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Candidate Acceptance:").Bold();
                                c.Item().PaddingTop(35).Text("_________________________________");
                                c.Item().Text($"{candidate.FullName} (Signature)");
                            });
                        });
                    });

                page.Footer()
                    .AlignCenter()
                    .Text(x =>
                    {
                        x.Span("Recruitment Gorilla ATS • Confidential • Page ");
                        x.CurrentPageNumber();
                    });
            });
        });

        return document.GeneratePdf();
    }

    public async Task<OfferMetricsDto> GetMetricsAsync(int? accessUserId)
    {
        var candidatesQuery = ApplyCandidateAccess(db.Candidates.AsQueryable(), accessUserId);

        var totalOffers = await db.Offers
            .Where(o => candidatesQuery.Any(c => c.Id == o.CandidateId))
            .CountAsync();

        var activeOffers = await db.Offers
            .Where(o => candidatesQuery.Any(c => c.Id == o.CandidateId))
            .Where(o => o.Status == "Extended" || o.Status == "PendingApproval" || o.Status == "Approved")
            .CountAsync();

        var acceptedOffers = await db.Offers
            .Where(o => candidatesQuery.Any(c => c.Id == o.CandidateId))
            .Where(o => o.Status == "Accepted")
            .CountAsync();

        var declinedOffers = await db.Offers
            .Where(o => candidatesQuery.Any(c => c.Id == o.CandidateId))
            .Where(o => o.Status == "Declined")
            .CountAsync();

        var totalHired = await candidatesQuery
            .Where(c => c.CurrentStatus == "Hired")
            .CountAsync();

        var totalDecided = acceptedOffers + declinedOffers;
        var rate = totalDecided > 0 ? Math.Round((double)acceptedOffers / totalDecided * 100, 1) : 0;

        return new OfferMetricsDto(totalOffers, activeOffers, acceptedOffers, declinedOffers, totalHired, rate);
    }

    private static OfferDto MapToDto(Offer o) =>
        new(
            o.Id,
            o.CandidateId,
            o.Candidate?.FullName ?? string.Empty,
            o.Candidate?.Email ?? string.Empty,
            o.JobTitle,
            o.BaseSalary,
            o.Currency,
            o.Bonus,
            o.Equity,
            o.StartDate,
            o.ExpirationDate,
            o.Notes,
            o.Status,
            o.CreatedByUserId,
            o.CreatedByUser?.Name ?? string.Empty,
            o.CreatedAt,
            o.UpdatedAt,
            o.ExtendedAt,
            o.RespondedAt,
            o.DeclineReason,
            o.Approvals.Select(a => new OfferApprovalDto(
                a.Id,
                a.OfferId,
                a.ApproverUserId,
                a.ApproverUser?.Name ?? string.Empty,
                a.ApproverUser?.Email ?? string.Empty,
                a.Status,
                a.Comment,
                a.ReviewedAt,
                a.CreatedAt
            )).ToList()
        );
}
