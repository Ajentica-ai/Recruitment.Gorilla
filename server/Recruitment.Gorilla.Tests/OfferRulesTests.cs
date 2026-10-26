using System.Net;
using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// Offer actions move the candidate through the same checks a status change does (#193): the job opening's End
/// Date lock, the candidate's stage, the transition rules, and one live offer per candidate.
/// </summary>
public class OfferRulesTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private static CreateOfferDto Terms() => new("Engineer", 100000, "USD", null, null, null, null, null);

    private Task<OfferDto?> CreateAsync(Candidate candidate, User admin) =>
        Offers().CreateOfferAsync(candidate.Id, Terms(), null, admin.Id, admin.Name);

    private async Task<int> TimelineRowsAsync(int candidateId, string status) =>
        await Db.StatusHistories.CountAsync(h => h.CandidateId == candidateId && h.Status == status);

    /// <summary>A candidate in an ended job opening, with an offer already in <paramref name="status"/>.</summary>
    private async Task<(Candidate Candidate, Offer Offer, User Admin)> EndedOpeningAsync(string status, string candidateStatus)
    {
        var admin = Data.AddUser(Roles.Admin);
        var role = Data.AddRole(null, DateTime.UtcNow.AddDays(-1));
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, roleId: role.Id, status: candidateStatus);
        var offer = new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = status, CreatedByUserId = admin.Id,
        };
        Db.Offers.Add(offer);
        await Db.SaveChangesAsync();
        return (candidate, offer, admin);
    }

    // ---- creating: the candidate's stage ----

    [Theory]
    [InlineData("Uploaded")]
    [InlineData("Reject")]
    [InlineData("Hired")]
    [InlineData("Interview Scheduled")]
    [InlineData("Offer Accepted")]
    [InlineData("Discontinued")]
    public async Task An_offer_cannot_be_raised_for_a_candidate_who_is_not_at_an_offer_stage(string status)
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: status);

        var ex = await Assert.ThrowsAsync<OfferRuleException>(() => CreateAsync(candidate, admin));

        Assert.Contains(status, ex.Message);
        Assert.Empty(Db.Offers.Where(o => o.CandidateId == candidate.Id));
        Assert.Equal(status, Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
    }

    [Theory]
    [InlineData("Recommended")]
    [InlineData("Offer Preparation")]
    [InlineData("Offer Declined")]
    public async Task An_offer_can_be_raised_from_the_stages_that_lead_to_one_and_lands_in_offer_preparation(string status)
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: status);

        var offer = await CreateAsync(candidate, admin);

        Assert.Equal("Draft", offer!.Status);
        Assert.Equal("Offer Preparation", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
    }

    // ---- one live offer per candidate ----

    [Theory]
    [InlineData("Draft")]
    [InlineData("PendingApproval")]
    [InlineData("Approved")]
    [InlineData("Extended")]
    public async Task A_second_offer_is_refused_while_one_is_still_live(string status)
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Offer Preparation");
        Db.Offers.Add(new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = status, CreatedByUserId = admin.Id,
        });
        await Db.SaveChangesAsync();

        await Assert.ThrowsAsync<OfferStateException>(() => CreateAsync(candidate, admin));

        Assert.Equal(1, Db.Offers.Count(o => o.CandidateId == candidate.Id));
    }

    [Fact]
    public async Task A_new_offer_is_allowed_once_the_last_one_was_declined()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Offer Declined");
        Db.Offers.Add(new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = "Declined", CreatedByUserId = admin.Id,
        });
        await Db.SaveChangesAsync();

        Assert.NotNull(await CreateAsync(candidate, admin));
    }

    [Fact]
    public async Task Another_candidates_live_offer_does_not_block_this_one()
    {
        var admin = Data.AddUser(Roles.Admin);
        var other = Data.AddCandidate(ownerUserId: admin.Id, status: "Recommended");
        await CreateAsync(other, admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Recommended");

        Assert.NotNull(await CreateAsync(candidate, admin));
    }

    // ---- the End Date lock on every offer action ----

    [Fact]
    public async Task Creating_an_offer_is_refused_after_the_job_opening_ended()
    {
        var admin = Data.AddUser(Roles.Admin);
        var role = Data.AddRole(null, DateTime.UtcNow.AddDays(-1));
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, roleId: role.Id, status: "Recommended");

        var ex = await Assert.ThrowsAsync<OfferRuleException>(() => CreateAsync(candidate, admin));

        Assert.Contains("ended", ex.Message);
        Assert.Empty(Db.Offers.Where(o => o.CandidateId == candidate.Id));
        Assert.Equal("Recommended", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
    }

    [Fact]
    public async Task Editing_a_draft_is_refused_after_the_job_opening_ended()
    {
        var (_, offer, admin) = await EndedOpeningAsync("Draft", "Offer Preparation");

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().UpdateOfferAsync(
            offer.Id, offer.CandidateId, new UpdateOfferDto("Engineer", 1, "USD", null, null, null, null, null), null, admin.Id, admin.Name));

        Assert.Equal(90000, Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).BaseSalary);
    }

    [Fact]
    public async Task Submitting_is_refused_after_the_job_opening_ended()
    {
        var (_, offer, admin) = await EndedOpeningAsync("Draft", "Offer Preparation");

        await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null));

        Assert.Equal("Draft", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
    }

    [Fact]
    public async Task Reviewing_is_refused_after_the_job_opening_ended()
    {
        var (candidate, offer, admin) = await EndedOpeningAsync("PendingApproval", "Offer Preparation");

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().ReviewApprovalAsync(
            offer.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name));

        Assert.Equal("PendingApproval", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
    }

    [Fact]
    public async Task Extending_is_refused_after_the_job_opening_ended_and_leaves_offer_and_candidate_alone()
    {
        var (candidate, offer, admin) = await EndedOpeningAsync("Approved", "Offer Preparation");

        var ex = await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Assert.Contains("ended", ex.Message);
        Assert.Equal("Approved", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
        Assert.Equal("Offer Preparation", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
        Assert.Equal(0, await TimelineRowsAsync(candidate.Id, "Offer Extended"));
    }

    [Fact]
    public async Task Recording_a_decision_is_refused_after_the_job_opening_ended()
    {
        var (candidate, offer, admin) = await EndedOpeningAsync("Extended", "Offer Extended");

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().RecordDecisionAsync(
            offer.Id, offer.CandidateId, new OfferDecisionDto("Accepted", null), admin.Id, admin.Name, null));

        Assert.Equal("Extended", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
        Assert.Equal(0, await TimelineRowsAsync(candidate.Id, "Offer Accepted"));
    }

    // ---- the candidate's status and the transition rules on extend and decision ----

    [Theory]
    [InlineData("Reject")]
    [InlineData("Hired")]
    [InlineData("Discontinued")]
    public async Task Extending_for_a_candidate_who_left_the_pipeline_is_refused_and_writes_nothing(string candidateStatus)
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: candidateStatus);
        var offer = new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = "Approved", CreatedByUserId = admin.Id,
        };
        Db.Offers.Add(offer);
        await Db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Assert.Contains(candidateStatus, ex.Message);
        Assert.Equal("Approved", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
        Assert.Equal(candidateStatus, Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
        Assert.Equal(0, await TimelineRowsAsync(candidate.Id, "Offer Extended"));
    }

    [Fact]
    public async Task A_decision_for_a_candidate_who_is_no_longer_at_offer_extended_is_refused_and_writes_nothing()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Reject");
        var offer = new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = "Extended", CreatedByUserId = admin.Id,
        };
        Db.Offers.Add(offer);
        await Db.SaveChangesAsync();

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().RecordDecisionAsync(
            offer.Id, offer.CandidateId, new OfferDecisionDto("Accepted", null), admin.Id, admin.Name, null));

        Assert.Equal("Extended", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
        Assert.Equal("Reject", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
    }

    [Fact]
    public async Task Editing_the_draft_of_a_candidate_who_was_rejected_is_refused()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Reject");
        var offer = new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = "Draft", CreatedByUserId = admin.Id,
        };
        Db.Offers.Add(offer);
        await Db.SaveChangesAsync();

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().UpdateOfferAsync(
            offer.Id, offer.CandidateId, new UpdateOfferDto("Engineer", 1, "USD", null, null, null, null, null), null, admin.Id, admin.Name));
        await Assert.ThrowsAsync<OfferRuleException>(() =>
            Offers().SubmitForApprovalAsync(offer.Id, offer.CandidateId, null, admin.Id, admin.Name, null));
    }

    [Fact]
    public async Task Extending_checks_the_candidates_stored_status_not_the_one_this_request_loaded()
    {
        // A manual status change committed after the candidate was read, as a second request would do it.
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Offer Preparation");
        var offer = new Offer
        {
            CandidateId = candidate.Id, JobTitle = "Engineer", BaseSalary = 90000, Currency = "USD",
            Status = "Approved", CreatedByUserId = admin.Id,
        };
        Db.Offers.Add(offer);
        await Db.SaveChangesAsync();
        await Db.Database.ExecuteSqlInterpolatedAsync($"UPDATE Candidates SET CurrentStatus = 'Reject' WHERE Id = {candidate.Id}");

        await Assert.ThrowsAsync<OfferRuleException>(() => Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null));

        Assert.Equal("Approved", Db.Offers.AsNoTracking().Single(o => o.Id == offer.Id).Status);
        Assert.Equal(0, await TimelineRowsAsync(candidate.Id, "Offer Extended"));
    }

    [Fact]
    public async Task The_normal_path_still_works_end_to_end()
    {
        var admin = Data.AddUser(Roles.Admin);
        var candidate = Data.AddCandidate(ownerUserId: admin.Id, status: "Recommended");

        var offer = await CreateAsync(candidate, admin);
        await Offers().SubmitForApprovalAsync(offer!.Id, offer.CandidateId, null, admin.Id, admin.Name, null);
        await Offers().ReviewApprovalAsync(offer.Id, candidate.Id, new ReviewOfferApprovalDto("Approved", null), admin.Id, admin.Name);
        await Offers().ExtendOfferAsync(offer.Id, offer.CandidateId, admin.Id, admin.Name, null);
        var decided = await Offers().RecordDecisionAsync(offer.Id, offer.CandidateId, new OfferDecisionDto("Accepted", null), admin.Id, admin.Name, null);

        Assert.Equal("Accepted", decided!.Status);
        Assert.Equal("Offer Accepted", Db.Candidates.AsNoTracking().Single(c => c.Id == candidate.Id).CurrentStatus);
        Assert.Equal(1, await TimelineRowsAsync(candidate.Id, "Offer Extended"));
    }
}

/// <summary>The same rules over the real HTTP pipeline: 400 for the candidate's state, 409 for a second offer.</summary>
[Collection(ApiCollection.Name)]
public class OfferRulesApiTests(ApiFixture fx)
{
    private static string Url(int candidateId, string tail = "") => $"/api/candidates/{candidateId}/offers{tail}";

    [Theory]
    [InlineData("Uploaded")]
    [InlineData("Reject")]
    [InlineData("Hired")]
    public async Task Creating_an_offer_for_a_candidate_not_at_an_offer_stage_is_a_400(string status)
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: status);
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { baseSalary = 90000 });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains(status, await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Creating_an_offer_after_the_job_opening_ended_is_a_400()
    {
        var roleId = await fx.NewRoleAsync(DateTime.UtcNow.AddDays(-1));
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, roleId, status: "Recommended");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { baseSalary = 90000 });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("ended", await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_second_live_offer_is_a_409()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Recommended");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var first = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { baseSalary = 90000 });
        var second = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { baseSalary = 95000 });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Extending_after_the_job_opening_ended_is_a_400_and_the_offer_stays_approved()
    {
        var roleId = await fx.NewRoleAsync(DateTime.UtcNow.AddDays(-1));
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, roleId, status: "Offer Preparation");
        var offerId = await fx.NewOfferAsync(candidateId, "Approved");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/extend"), token);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, await fx.CountStatusRowsAsync(candidateId, "Offer Extended"));
    }

    [Fact]
    public async Task Extending_for_a_rejected_candidate_is_a_400()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Reject");
        var offerId = await fx.NewOfferAsync(candidateId, "Approved");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var resp = await fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/extend"), token);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, await fx.CountStatusRowsAsync(candidateId, "Offer Extended"));
    }

    [Fact]
    public async Task Two_simultaneous_extends_make_one_success_one_conflict_and_one_timeline_row()
    {
        for (var round = 0; round < 6; round++)
        {
            var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Offer Preparation");
            var offerId = await fx.NewOfferAsync(candidateId, "Approved");
            var token = await fx.LoginAsync(fx.AdminEmail);

            var responses = await Task.WhenAll(
                Enumerable.Range(0, 2).Select(_ => fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/extend"), token)));

            var codes = responses.Select(r => r.StatusCode).OrderBy(c => c).ToList();
            Assert.Equal([HttpStatusCode.OK, HttpStatusCode.Conflict], codes);
            Assert.Equal(1, await fx.CountStatusRowsAsync(candidateId, "Offer Extended"));
        }
    }

    [Theory]
    [InlineData("ended")]
    [InlineData("rejected")]
    [InlineData("live-offer")]
    public async Task A_recruiter_outside_the_candidates_scope_gets_a_404_not_the_rule_that_applies(string situation)
    {
        // The scope check runs before every rule, so the new 400 and 409 messages (which name the candidate, its
        // status or the job opening) cannot be used to probe a candidate the caller cannot see.
        var roleId = situation == "ended" ? await fx.NewRoleAsync(DateTime.UtcNow.AddDays(-1)) : (int?)null;
        var candidateId = await fx.NewCandidateAsync(
            fx.AdminId, roleId, status: situation == "rejected" ? "Reject" : "Offer Preparation");
        var offerId = await fx.NewOfferAsync(candidateId, situation == "live-offer" ? "Draft" : "Approved");
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        var responses = new[]
        {
            await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { baseSalary = 90000 }),
            await fx.SendAsync(HttpMethod.Put, Url(candidateId, $"/{offerId}"), token, new { baseSalary = 91000 }),
            await fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/submit-approval"), token, new int[0]),
            await fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/extend"), token),
            await fx.SendAsync(HttpMethod.Post, Url(candidateId, $"/{offerId}/decision"), token, new { decision = "Accepted" }),
        };

        foreach (var resp in responses)
        {
            Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
            var body = await resp.Content.ReadAsStringAsync();
            Assert.DoesNotContain("ended", body);
            Assert.DoesNotContain("Reject", body);
            Assert.DoesNotContain("in progress", body);
        }
    }
}

/// <summary>
/// The candidate id in the URL is checked before anything is written (#194). Before, update, submit, extend and
/// decision committed (offer, audit row, candidate status) and only then compared the ids, so a mismatched URL
/// changed another candidate's offer and still answered 404.
/// </summary>
[Collection(ApiCollection.Name)]
public class OfferUrlCandidateTests(ApiFixture fx)
{
    private static string Url(int candidateId, int offerId, string tail = "") =>
        $"/api/candidates/{candidateId}/offers/{offerId}{tail}";

    /// <summary>An offer for candidate B, reached through candidate A's URL.</summary>
    private async Task<(int WrongCandidateId, int OfferId, string Token)> MismatchAsync(string offerStatus, string candidateStatus)
    {
        var wrong = await fx.NewCandidateAsync(fx.AdminId, status: "Offer Preparation");
        var owner = await fx.NewCandidateAsync(fx.AdminId, status: candidateStatus);
        var offerId = await fx.NewOfferAsync(owner, offerStatus);
        return (wrong, offerId, await fx.LoginAsync(fx.AdminEmail));
    }

    private async Task AssertRefusedAndUntouchedAsync(
        HttpResponseMessage resp, int offerId, string offerStatus, string candidateStatus)
    {
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        var (status, cStatus, audits) = await fx.OfferSnapshotAsync(offerId);
        Assert.Equal(offerStatus, status);
        Assert.Equal(candidateStatus, cStatus);
        Assert.Equal(0, audits);
    }

    [Fact]
    public async Task Updating_through_another_candidates_url_is_a_404_and_writes_nothing()
    {
        var (wrong, offerId, token) = await MismatchAsync("Draft", "Offer Preparation");
        var resp = await fx.SendAsync(HttpMethod.Put, Url(wrong, offerId), token, new { baseSalary = 1 });
        await AssertRefusedAndUntouchedAsync(resp, offerId, "Draft", "Offer Preparation");
        Assert.Equal(90000, await fx.OfferSalaryAsync(offerId));
    }

    [Fact]
    public async Task Submitting_through_another_candidates_url_is_a_404_and_writes_nothing()
    {
        var (wrong, offerId, token) = await MismatchAsync("Draft", "Offer Preparation");
        var resp = await fx.SendAsync(HttpMethod.Post, Url(wrong, offerId, "/submit-approval"), token, new int[0]);
        await AssertRefusedAndUntouchedAsync(resp, offerId, "Draft", "Offer Preparation");
    }

    [Fact]
    public async Task Extending_through_another_candidates_url_is_a_404_and_the_candidate_is_not_moved()
    {
        var (wrong, offerId, token) = await MismatchAsync("Approved", "Offer Preparation");
        var resp = await fx.SendAsync(HttpMethod.Post, Url(wrong, offerId, "/extend"), token);
        await AssertRefusedAndUntouchedAsync(resp, offerId, "Approved", "Offer Preparation");
    }

    [Fact]
    public async Task Recording_a_decision_through_another_candidates_url_is_a_404_and_writes_nothing()
    {
        var (wrong, offerId, token) = await MismatchAsync("Extended", "Offer Extended");
        var resp = await fx.SendAsync(HttpMethod.Post, Url(wrong, offerId, "/decision"), token, new { decision = "Accepted" });
        await AssertRefusedAndUntouchedAsync(resp, offerId, "Extended", "Offer Extended");
    }

    [Fact]
    public async Task The_offer_letter_pdf_through_another_candidates_url_is_a_404()
    {
        var (wrong, offerId, token) = await MismatchAsync("Draft", "Offer Preparation");
        var resp = await fx.SendAsync(HttpMethod.Get, Url(wrong, offerId, "/pdf"), token);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task The_offer_letter_pdf_through_its_own_candidates_url_still_works()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Offer Preparation");
        var offerId = await fx.NewOfferAsync(candidateId);
        var token = await fx.LoginAsync(fx.AdminEmail);
        var resp = await fx.SendAsync(HttpMethod.Get, Url(candidateId, offerId, "/pdf"), token);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Extending_twice_is_a_409_the_second_time_with_one_timeline_row()
    {
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, status: "Offer Preparation");
        var offerId = await fx.NewOfferAsync(candidateId, "Approved");
        var token = await fx.LoginAsync(fx.AdminEmail);

        var first = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);
        var second = await fx.SendAsync(HttpMethod.Post, Url(candidateId, offerId, "/extend"), token);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(1, await fx.CountStatusRowsAsync(candidateId, "Offer Extended"));
    }
}
