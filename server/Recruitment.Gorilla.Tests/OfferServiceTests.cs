using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

public class OfferServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    [Fact]
    public async Task CreateOffer_creates_draft_and_transitions_recommended_candidate()
    {
        var candidate = Data.AddCandidate(status: "Recommended");
        var user = Data.AddUser(Roles.Admin);

        var dto = new CreateOfferDto(
            JobTitle: "Senior Backend Developer",
            BaseSalary: 120000,
            Currency: "USD",
            Bonus: 15000,
            Equity: "10,000 RSUs",
            StartDate: DateTime.UtcNow.AddDays(30),
            ExpirationDate: DateTime.UtcNow.AddDays(14),
            Notes: "Remote position with standard healthcare"
        );

        var created = await Offers().CreateOfferAsync(candidate.Id, dto, null, user.Id, user.Name);

        Assert.NotNull(created);
        Assert.Equal(candidate.Id, created.CandidateId);
        Assert.Equal(120000, created.BaseSalary);
        Assert.Equal("USD", created.Currency);
        Assert.Equal("Draft", created.Status);

        // Candidate status should move to "Offer Preparation"
        var updatedCandidate = await Candidates().GetByIdAsync(candidate.Id);
        Assert.NotNull(updatedCandidate);
        Assert.Equal("Offer Preparation", updatedCandidate.CurrentStatus);
    }

    [Fact]
    public async Task SubmitForApproval_and_Review_flow_works_correctly()
    {
        var candidate = Data.AddCandidate(status: "Recommended");
        var admin = Data.AddUser(Roles.Admin);
        var approver = Data.AddUser(Roles.SuperAdmin);

        var offer = await Offers().CreateOfferAsync(
            candidate.Id,
            new CreateOfferDto("Lead Engineer", 140000, "USD", 20000, null, null, null, null),
            null,
            admin.Id,
            admin.Name);
        Assert.NotNull(offer);

        // Submit for approval
        var pending = await Offers().SubmitForApprovalAsync(offer.Id, [approver.Id], admin.Id, admin.Name, null);
        Assert.NotNull(pending);
        Assert.Equal("PendingApproval", pending.Status);
        Assert.Single(pending.Approvals);
        Assert.Equal("Pending", pending.Approvals[0].Status);

        // Review approval - Approve
        var reviewed = await Offers().ReviewApprovalAsync(
            offer.Id,
            candidate.Id,
            new ReviewOfferApprovalDto("Approved", "Approved compensation package"),
            approver.Id,
            approver.Name);
        Assert.NotNull(reviewed);
        Assert.Equal("Approved", reviewed.Status);
        Assert.Equal("Approved", reviewed.Approvals[0].Status);
    }

    [Fact]
    public async Task ExtendOffer_and_Accept_transitions_to_Hired()
    {
        var candidate = Data.AddCandidate(status: "Offer Preparation");
        var admin = Data.AddUser(Roles.Admin);

        var offer = await Offers().CreateOfferAsync(
            candidate.Id,
            new CreateOfferDto("Tech Lead", 160000, "USD", null, null, null, null, null),
            null,
            admin.Id,
            admin.Name);
        Assert.NotNull(offer);

        // Extend offer
        var extended = await Offers().ExtendOfferAsync(offer.Id, admin.Id, admin.Name, null);
        Assert.NotNull(extended);
        Assert.Equal("Extended", extended.Status);

        var candAfterExtend = await Candidates().GetByIdAsync(candidate.Id);
        Assert.NotNull(candAfterExtend);
        Assert.Equal("Offer Extended", candAfterExtend.CurrentStatus);

        // Candidate accepts
        var accepted = await Offers().RecordDecisionAsync(
            offer.Id,
            new OfferDecisionDto("Accepted", null),
            admin.Id,
            admin.Name,
            null);
        Assert.NotNull(accepted);
        Assert.Equal("Accepted", accepted.Status);

        var candAfterAccept = await Candidates().GetByIdAsync(candidate.Id);
        Assert.NotNull(candAfterAccept);
        Assert.Equal("Offer Accepted", candAfterAccept.CurrentStatus);

        // Move to Hired
        var hireError = await Candidates().ValidateStatusChangeAsync(
            candidate.Id,
            new StatusChangeDto("Hired", "Candidate completed onboarding"));
        Assert.Null(hireError);

        var hired = await Candidates().AddStatusAsync(
            candidate.Id,
            new StatusChangeDto("Hired", "Welcome aboard!"),
            admin.Name,
            admin.Id);
        Assert.NotNull(hired);

        var candHired = await Candidates().GetByIdAsync(candidate.Id);
        Assert.NotNull(candHired);
        Assert.Equal("Hired", candHired.CurrentStatus);
    }

    [Fact]
    public async Task GenerateOfferLetterPdf_returns_valid_pdf_stream()
    {
        var candidate = Data.AddCandidate(status: "Offer Preparation");
        var admin = Data.AddUser(Roles.Admin);

        var offer = await Offers().CreateOfferAsync(
            candidate.Id,
            new CreateOfferDto(
                "Full Stack Architect",
                150000,
                "USD",
                10000,
                "5,000 Stock Options",
                DateTime.UtcNow.AddDays(20),
                DateTime.UtcNow.AddDays(7),
                "Includes 4 weeks PTO and 401(k) match"),
            null,
            admin.Id,
            admin.Name);
        Assert.NotNull(offer);

        var pdfBytes = await Offers().GenerateOfferLetterPdfAsync(offer.Id, null);
        Assert.NotNull(pdfBytes);
        Assert.NotEmpty(pdfBytes);
        // PDF header magic bytes "%PDF-"
        Assert.True(pdfBytes.Length > 100);
        Assert.Equal((byte)'%', pdfBytes[0]);
        Assert.Equal((byte)'P', pdfBytes[1]);
        Assert.Equal((byte)'D', pdfBytes[2]);
        Assert.Equal((byte)'F', pdfBytes[3]);
    }

    // ---- Access and state checks --------------------------------------------------------------
    // CreateOfferAsync loaded the candidate by id alone, unlike every sibling method, so any
    // Recruiter could raise an offer on any candidate. ReviewApprovalAsync had no status check and
    // compared the candidate id only after saving. Who may review is a controller gate, covered in
    // ControllerAuthorizationTests.

    private static CreateOfferDto Salary() => new("Engineer", 90000, "USD", null, null, null, null, null);

    [Fact]
    public async Task CreateOffer_refuses_a_candidate_outside_the_recruiters_scope()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Recommended");
        var recruiter = Data.AddUser(Roles.Recruiter);

        var created = await Offers().CreateOfferAsync(candidate.Id, Salary(), recruiter.Id, recruiter.Id, recruiter.Name);

        Assert.Null(created);
        Assert.False(Db.Offers.Any(o => o.CandidateId == candidate.Id));
        // The side effect is refused too: a Recommended candidate is not moved to Offer Preparation.
        Assert.Equal("Recommended", (await Candidates().GetByIdAsync(candidate.Id))!.CurrentStatus);
    }

    [Fact]
    public async Task CreateOffer_allows_the_recruiter_who_owns_the_candidate()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: recruiter.Id);

        Assert.NotNull(await Offers().CreateOfferAsync(candidate.Id, Salary(), recruiter.Id, recruiter.Id, recruiter.Name));
    }

    [Fact]
    public async Task CreateOffer_allows_a_recruiter_assigned_to_the_candidates_role()
    {
        // The other half of the scope rule: not the owner, but an assigned recruiter of its role.
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var role = Data.AddRole(null, null, recruiter.Id);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, roleId: role.Id);

        Assert.NotNull(await Offers().CreateOfferAsync(candidate.Id, Salary(), recruiter.Id, recruiter.Id, recruiter.Name));
    }

    [Fact]
    public async Task SubmitForApproval_ignores_named_approvers_who_cannot_review()
    {
        // Review is Admin+ only, so a Recruiter named as approver could never act, and their
        // Pending row would block the offer from ever reaching Approved.
        var admin = Data.AddUser(Roles.Admin);
        var recruiter = Data.AddUser(Roles.Recruiter);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id);
        var offer = await Offers().CreateOfferAsync(candidate.Id, Salary(), null, admin.Id, admin.Name);
        Assert.NotNull(offer);

        var pending = await Offers().SubmitForApprovalAsync(offer.Id, [recruiter.Id, admin.Id], admin.Id, admin.Name, null);

        Assert.NotNull(pending);
        Assert.DoesNotContain(pending.Approvals, a => a.ApproverUserId == recruiter.Id);
        Assert.Contains(pending.Approvals, a => a.ApproverUserId == admin.Id);
    }

    [Fact]
    public async Task Review_refuses_an_offer_that_is_not_awaiting_approval()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id);
        var draft = await Offers().CreateOfferAsync(candidate.Id, Salary(), null, admin.Id, admin.Name);
        Assert.NotNull(draft);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Offers().ReviewApprovalAsync(
            draft.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name));

        Assert.Equal("Draft", Db.Offers.Single(o => o.Id == draft.Id).Status);
    }

    [Fact]
    public async Task Review_with_a_mismatched_candidate_id_writes_nothing()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id);
        var otherCandidate = Data.AddCandidate(ownerUserId: admin.Id);
        var offer = await Offers().CreateOfferAsync(candidate.Id, Salary(), null, admin.Id, admin.Name);
        Assert.NotNull(offer);
        await Offers().SubmitForApprovalAsync(offer.Id, [admin.Id], admin.Id, admin.Name, null);

        var reviewed = await Offers().ReviewApprovalAsync(
            offer.Id, otherCandidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name);

        Assert.Null(reviewed);
        Assert.Equal("PendingApproval", Db.Offers.Single(o => o.Id == offer.Id).Status);
        Assert.All(Db.OfferApprovals.Where(a => a.OfferId == offer.Id), a => Assert.Equal("Pending", a.Status));
    }
}
