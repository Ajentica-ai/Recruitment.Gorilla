using System.Net;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// An offer's approval binds the offer that is sent (#192). Terms can only change on a Draft, an offer is
/// submitted only from Draft, and it is extended only once approved, or straight from a Draft (approval is
/// optional) unless an Admin has rejected that Draft: then it must be resubmitted and approved first. Every
/// refusal is a conflict, never a silent change and never a 500.
/// </summary>
public class OfferStateMachineTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static UpdateOfferDto NewTerms(decimal salary = 200000) =>
        new("Staff Engineer", salary, "USD", 10000, "5,000 RSUs", null, null, "revised terms");

    private async Task<(Candidate Candidate, OfferDto Offer, User Admin)> DraftAsync(string status = "Recommended")
    {
        var candidate = Data.AddCandidate(status: status);
        var admin = Data.AddUser(Roles.Admin);
        var offer = await Offers().CreateOfferAsync(
            candidate.Id, new CreateOfferDto("Engineer", 100000, "USD", null, null, null, null, null), null, admin.Id, admin.Name);
        return (candidate, offer!, admin);
    }

    /// <summary>An offer put straight into <paramref name="status"/>, however it would normally get there.</summary>
    private async Task<(Candidate Candidate, OfferDto Offer, User Admin)> InStatusAsync(string status)
    {
        var (candidate, offer, admin) = await DraftAsync();
        var row = await Db.Offers.SingleAsync(o => o.Id == offer.Id);
        row.Status = status;
        await Db.SaveChangesAsync();
        return (candidate, offer, admin);
    }

    /// <summary>A Draft an Admin has rejected, reached the way a real one is: submitted, then reviewed.</summary>
    private async Task<(Candidate Candidate, OfferDto Offer, User Admin)> RejectedDraftAsync()
    {
        var (candidate, offer, admin) = await DraftAsync();
        await Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null);
        var rejected = await Offers().ReviewApprovalAsync(
            offer.Id, candidate.Id, new ReviewOfferApprovalDto("Rejected", "too high"), admin.Id, admin.Name);
        Assert.Equal("Draft", rejected!.Status);
        return (candidate, offer, admin);
    }

    // ---- update terms: Draft only ----

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task Terms_cannot_be_changed_unless_the_offer_is_a_draft(string status)
    {
        var (_, offer, admin) = await InStatusAsync(status);

        var ex = await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(), null, admin.Id, admin.Name));

        Assert.Contains(status, ex.Message);
        var stored = await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id);
        Assert.Equal(100000, stored.BaseSalary); // untouched
        Assert.Equal(status, stored.Status);
    }

    [Fact]
    public async Task A_draft_can_still_be_edited()
    {
        var (_, offer, admin) = await DraftAsync();

        var updated = await Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(150000), null, admin.Id, admin.Name);

        Assert.Equal(150000, updated!.BaseSalary);
        Assert.Equal("Draft", updated.Status);
    }

    // ---- submit for approval: Draft only ----

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task An_offer_is_submitted_for_approval_only_from_draft(string status)
    {
        var (_, offer, admin) = await InStatusAsync(status);

        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null));

        Assert.Equal(status, (await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id)).Status);
    }

    // ---- extend: Approved, or an un-rejected Draft ----

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task An_offer_cannot_be_extended_before_approval_or_twice(string status)
    {
        var (candidate, offer, admin) = await InStatusAsync(status);

        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Assert.Equal(status, (await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id)).Status);
        Assert.NotEqual("Offer Extended", (await Candidates().GetByIdAsync(candidate.Id))!.CurrentStatus);
    }

    [Fact]
    public async Task A_rejected_draft_cannot_be_extended()
    {
        var (candidate, offer, admin) = await RejectedDraftAsync();

        var ex = await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Assert.Contains("rejected", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Draft", (await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id)).Status);
        Assert.NotEqual("Offer Extended", (await Candidates().GetByIdAsync(candidate.Id))!.CurrentStatus);
    }

    [Fact]
    public async Task Editing_a_rejected_draft_does_not_make_it_extendable()
    {
        var (_, offer, admin) = await RejectedDraftAsync();

        await Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(90000), null, admin.Id, admin.Name); // allowed: still a Draft

        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));
    }

    [Fact]
    public async Task A_rejected_offer_is_extended_only_after_it_is_resubmitted_and_approved()
    {
        var (candidate, offer, admin) = await RejectedDraftAsync();
        await Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(90000), null, admin.Id, admin.Name);

        await Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null);
        var approved = await Offers().ReviewApprovalAsync(
            offer.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", "ok now"), admin.Id, admin.Name);
        Assert.Equal("Approved", approved!.Status);

        var extended = await Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null);
        Assert.Equal("Extended", extended!.Status);
        Assert.Equal(90000, extended.BaseSalary);
    }

    [Fact]
    public async Task An_approved_offer_can_be_extended_and_its_terms_are_then_frozen()
    {
        var (candidate, offer, admin) = await DraftAsync();
        await Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null);
        await Offers().ReviewApprovalAsync(offer.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name);

        // The edit the issue is about: changing the figures after approval is refused.
        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(), null, admin.Id, admin.Name));

        var extended = await Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null);
        Assert.Equal("Extended", extended!.Status);
        Assert.Equal(100000, extended.BaseSalary); // exactly what was approved
    }

    [Fact]
    public async Task A_draft_that_was_never_rejected_can_still_be_extended_directly_because_approval_is_optional()
    {
        var (_, offer, admin) = await DraftAsync();

        var extended = await Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null);

        Assert.Equal("Extended", extended!.Status);
    }

    // ---- a rejection applies to the candidate, not just the one offer row ----

    private Task<OfferDto?> NewVersionAsync(Candidate candidate, User admin) =>
        Offers().CreateOfferAsync(
            candidate.Id, new CreateOfferDto("Engineer v2", 100000, "USD", null, null, null, null, null), null, admin.Id, admin.Name);

    /// <summary>A rejected offer that was fixed, approved, extended and then declined by the candidate: the point
    /// where a new version is allowed (#193), with the earlier rejection still on record.</summary>
    private async Task<(Candidate Candidate, User Admin)> DeclinedAfterRejectionAsync()
    {
        var (candidate, offer, admin) = await RejectedDraftAsync();
        await Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null);
        await Offers().ReviewApprovalAsync(offer.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name);
        await Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null);
        await Offers().RecordDecisionAsync(offer.Id, offer.CandidateId, new OfferDecisionDto("Declined", "too low"), admin.Id, admin.Name, null);
        return (candidate, admin);
    }

    [Fact]
    public async Task A_new_version_after_a_rejection_cannot_be_extended_without_approval()
    {
        var (candidate, admin) = await DeclinedAfterRejectionAsync();
        var newVersion = await NewVersionAsync(candidate, admin);

        var ex = await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().ExtendOfferAsync(newVersion!.Id, newVersion.CandidateId, admin.Id, admin.Name, null));

        Assert.Contains("rejected", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Draft", (await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == newVersion.Id)).Status);
    }

    [Fact]
    public async Task A_new_version_is_extended_once_it_has_been_submitted_and_approved()
    {
        var (candidate, admin) = await DeclinedAfterRejectionAsync();
        var newVersion = await NewVersionAsync(candidate, admin);

        await Offers().SubmitForApprovalAsync(newVersion!.Id, newVersion.CandidateId, null, admin.Id, admin.Name, null);
        await Offers().ReviewApprovalAsync(newVersion.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name);
        var extended = await Offers().ExtendOfferAsync(newVersion.Id, newVersion.CandidateId, admin.Id, admin.Name, null);

        Assert.Equal("Extended", extended!.Status);
    }

    [Fact]
    public async Task A_rejection_on_one_candidate_does_not_affect_another_candidates_offers()
    {
        await RejectedDraftAsync();
        var (_, other, admin) = await DraftAsync();

        var extended = await Offers().ExtendOfferAsync(other.Id, other.CandidateId, admin.Id, admin.Name, null);

        Assert.Equal("Extended", extended!.Status);
    }

    // ---- record decision: Extended only (already enforced, kept as a guard) ----

    [Theory]
    [InlineData("Draft")]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Accepted")]
    public async Task A_decision_is_recorded_only_on_an_extended_offer(string status)
    {
        var (_, offer, admin) = await InStatusAsync(status);

        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().RecordDecisionAsync(offer.Id, offer.CandidateId, new OfferDecisionDto("Accepted", null), admin.Id, admin.Name, null));
    }

    // ---- a request that raced a status change is refused, never silently applied ----

    /// <summary>
    /// Another request moves the offer on after this one has read it: the tracked entity still says Draft, the
    /// row says otherwise. This is the race the state checks alone cannot see.
    /// </summary>
    private async Task<(OfferDto Offer, User Admin)> StaleDraftAsync(string actualStatus)
    {
        var (_, offer, admin) = await DraftAsync();
        await Db.Offers.SingleAsync(o => o.Id == offer.Id); // read as a Draft, and keep tracking it
        await Db.Database.ExecuteSqlRawAsync("UPDATE Offers SET Status = {0} WHERE Id = {1}", actualStatus, offer.Id);
        return (offer, admin);
    }

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    public async Task Editing_after_another_request_changed_the_status_is_refused_and_overwrites_nothing(string actual)
    {
        var (offer, admin) = await StaleDraftAsync(actual);

        var ex = await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().UpdateOfferAsync(offer.Id, offer.CandidateId, NewTerms(250000), null, admin.Id, admin.Name));

        Assert.Contains("changed by someone else", ex.Message);
        Db.ChangeTracker.Clear();
        var stored = await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id);
        Assert.Equal(100000, stored.BaseSalary); // the approved or sent terms stand
        Assert.Equal(actual, stored.Status);
    }

    [Fact]
    public async Task Extending_after_the_offer_was_submitted_in_the_meantime_is_refused_and_keeps_it_pending()
    {
        var (offer, admin) = await StaleDraftAsync("PendingApproval");

        await Assert.ThrowsAsync<OfferStateException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Db.ChangeTracker.Clear();
        Assert.Equal("PendingApproval", (await Db.Offers.AsNoTracking().SingleAsync(o => o.Id == offer.Id)).Status);
    }

    [Fact]
    public async Task Status_is_a_concurrency_token_without_any_schema_change()
    {
        var token = Db.Model.FindEntityType(typeof(Offer))!.FindProperty(nameof(Offer.Status))!.IsConcurrencyToken;
        Assert.True(token);
    }
}

/// <summary>The same rules over the real HTTP pipeline: a refusal is a 409 with the reason, never a 500.</summary>
[Collection(ApiCollection.Name)]
public class OfferStateMachineApiTests(ApiFixture fx)
{
    private static string Url(int candidateId, int offerId, string action = "") =>
        $"/api/candidates/{candidateId}/offers/{offerId}{action}";

    private async Task<(int CandidateId, int OfferId, string Token)> OfferAsync(string status, bool rejectedDraft = false)
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Offer Preparation");
        var offerId = rejectedDraft ? await fx.NewRejectedDraftOfferAsync(candidateId) : await fx.NewOfferAsync(candidateId, status);
        return (candidateId, offerId, await fx.LoginAsync(fx.AdminEmail));
    }

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task Updating_terms_is_a_409_unless_the_offer_is_a_draft(string status)
    {
        var (candidateId, offerId, token) = await OfferAsync(status);

        var resp = await fx.SendAsync(HttpMethod.Put, Url(candidateId, offerId), token, new { baseSalary = 250000 });

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Contains(status, await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Updating_a_draft_is_still_allowed()
    {
        var (candidateId, offerId, token) = await OfferAsync("Draft");

        var resp = await fx.SendAsync(HttpMethod.Put, Url(candidateId, offerId), token, new { baseSalary = 250000 });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task Submitting_for_approval_is_a_409_unless_the_offer_is_a_draft(string status)
    {
        var (candidateId, offerId, token) = await OfferAsync(status);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/submit-approval"), token, new int[0]);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    [Theory]
    [InlineData("PendingApproval")]
    [InlineData("Extended")]
    [InlineData("Accepted")]
    [InlineData("Declined")]
    public async Task Extending_is_a_409_before_approval_or_when_already_extended_or_decided(string status)
    {
        var (candidateId, offerId, token) = await OfferAsync(status);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    [Fact]
    public async Task Extending_a_rejected_draft_is_a_409_with_the_reason()
    {
        var (candidateId, offerId, token) = await OfferAsync("Draft", rejectedDraft: true);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Contains("rejected", await resp.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Extending_a_new_version_after_a_rejection_is_a_409()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        await fx.NewRejectedDraftOfferAsync(candidateId);
        var newVersion = await fx.NewOfferAsync(candidateId, "Draft");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, newVersion, "/extend"), token);

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
        Assert.Contains("rejected", await resp.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("Approved")]
    public async Task Extending_a_draft_or_an_approved_offer_is_allowed(string status)
    {
        var (candidateId, offerId, token) = await OfferAsync(status);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Accepted")]
    public async Task Recording_a_decision_on_an_offer_that_is_not_extended_is_a_409(string status)
    {
        var (candidateId, offerId, token) = await OfferAsync(status);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/decision"), token, new { decision = "Accepted" });

        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode); // was a 500
    }

    [Fact]
    public async Task Racing_an_edit_against_an_extend_never_leaves_an_extended_offer_with_terms_nobody_sent()
    {
        for (var round = 0; round < 8; round++)
        {
            var (candidateId, offerId, token) = await OfferAsync("Draft");
            var edit = fx.SendAsync(HttpMethod.Put, Url(candidateId, offerId), token, new { baseSalary = 777777 });
            var extend = fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);
            await Task.WhenAll(edit, extend);

            var stored = await fx.SendAsync(HttpMethod.Get, Url(candidateId, offerId), token);
            var body = await stored.Content.ReadAsStringAsync();
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var status = doc.RootElement.GetProperty("status").GetString();
            var salary = doc.RootElement.GetProperty("baseSalary").GetDecimal();
            if (extend.Result.StatusCode == HttpStatusCode.OK && edit.Result.StatusCode != HttpStatusCode.OK)
                Assert.Equal(90000, salary); // extended first: the edit was refused and nothing was overwritten
            if (status == "Extended" && edit.Result.StatusCode != HttpStatusCode.OK)
                Assert.Equal(90000, salary);
            // Whatever the order, a refusal is a 409, never a 500.
            Assert.DoesNotContain(HttpStatusCode.InternalServerError, new[] { edit.Result.StatusCode, extend.Result.StatusCode });
        }
    }

    [Theory]
    [InlineData("PUT", "")]
    [InlineData("POST", "/submit-approval")]
    [InlineData("POST", "/extend")]
    [InlineData("POST", "/decision")]
    public async Task A_recruiter_outside_the_candidates_scope_gets_404_never_the_offers_state(string method, string action)
    {
        // Owned by the Admin, no job opening: the Recruiter has no scope over this candidate, and the offer is in a
        // state that would be a 409 for someone who does.
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var offerId = await fx.NewOfferAsync(candidateId, "Approved");
        var recruiter = await fx.LoginAsync(fx.RecruiterEmail);
        object? body = action == "/decision" ? new { decision = "Accepted" } : action == "/submit-approval" ? new int[0] : method == "PUT" ? new { baseSalary = 1 } : null;

        var resp = await (body is null
            ? fx.SendAsync(new HttpMethod(method), Url(candidateId, offerId, action), recruiter)
            : fx.SendAsync(new HttpMethod(method), Url(candidateId, offerId, action), recruiter, body));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.DoesNotContain("Approved", await resp.Content.ReadAsStringAsync());
    }
}
