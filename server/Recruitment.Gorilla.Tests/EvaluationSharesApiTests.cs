using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// /api/candidates/{id}/evaluation-shares over the real HTTP pipeline (#183): the [Authorize] gate,
/// the Recruiter's candidate scope (404, not 403), and that a mismatched revoke writes nothing.
/// </summary>
[Collection(ApiCollection.Name)]
public class EvaluationSharesApiTests(ApiFixture fx)
{
    private static string Url(int candidateId) => $"/api/candidates/{candidateId}/evaluation-shares";

    private async Task<string> RecruiterToken() => await fx.LoginAsync(fx.RecruiterEmail);
    private async Task<string> AdminToken() => await fx.LoginAsync(fx.AdminEmail);
    private async Task<string> InterviewerToken() => await fx.LoginAsync(fx.InterviewerEmail);

    private object ShareBody() => new { granteeUserIds = new[] { fx.InterviewerId }, note = "for round 2" };

    private static async Task<JsonElement> Json(HttpResponseMessage resp)
    {
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    [Fact]
    public async Task Anonymous_callers_get_401_on_all_three_endpoints()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);

        Assert.Equal(HttpStatusCode.Unauthorized, (await fx.SendAsync(HttpMethod.Get, Url(candidateId), token: null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fx.SendAsync(HttpMethod.Post, Url(candidateId), null, ShareBody())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fx.SendAsync(HttpMethod.Delete, Url(candidateId) + "/1", token: null)).StatusCode);
    }

    [Fact]
    public async Task Interviewers_get_403_on_all_three_endpoints()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);
        var token = await InterviewerToken();

        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Get, Url(candidateId), token)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, ShareBody())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await fx.SendAsync(HttpMethod.Delete, Url(candidateId) + "/1", token)).StatusCode);
    }

    [Fact]
    public async Task A_recruiter_outside_the_candidates_scope_gets_404_and_nothing_is_written()
    {
        // Owned by the Admin, no job opening: the Recruiter has no scope over this candidate.
        var candidateId = await fx.NewCandidateAsync(fx.AdminId);
        var recruiter = await RecruiterToken();
        var admin = await AdminToken();

        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Url(candidateId), recruiter)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Post, Url(candidateId), recruiter, ShareBody())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Delete, Url(candidateId) + "/1", recruiter)).StatusCode);

        var listed = await Json(await fx.SendAsync(HttpMethod.Get, Url(candidateId), admin));
        Assert.Equal(0, listed.GetArrayLength());
    }

    [Fact]
    public async Task A_recruiter_can_share_list_and_revoke_for_a_candidate_they_own()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);
        var token = await RecruiterToken();

        var created = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, ShareBody());
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var body = await Json(created);
        var share = body.GetProperty("shares")[0];
        Assert.Equal(fx.InterviewerId, share.GetProperty("granteeUserId").GetInt32());
        Assert.Equal("Manual", share.GetProperty("source").GetString());
        Assert.True(share.GetProperty("isActive").GetBoolean());
        var shareId = share.GetProperty("id").GetInt32();

        var listed = await Json(await fx.SendAsync(HttpMethod.Get, Url(candidateId), token));
        Assert.Equal(1, listed.GetArrayLength());

        var revoked = await fx.SendAsync(HttpMethod.Delete, $"{Url(candidateId)}/{shareId}", token);
        Assert.Equal(HttpStatusCode.NoContent, revoked.StatusCode);

        var after = await Json(await fx.SendAsync(HttpMethod.Get, Url(candidateId), token));
        Assert.False(after[0].GetProperty("isActive").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, after[0].GetProperty("revokedAt").ValueKind);
    }

    [Fact]
    public async Task An_admin_can_share_for_any_candidate()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);

        var created = await fx.SendAsync(HttpMethod.Post, Url(candidateId), await AdminToken(), ShareBody());

        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        Assert.Equal(1, (await Json(created)).GetProperty("shares").GetArrayLength());
    }

    [Fact]
    public async Task Sharing_with_someone_who_already_has_access_reports_them_as_skipped()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);

        var created = await fx.SendAsync(
            HttpMethod.Post, Url(candidateId), await RecruiterToken(),
            new { granteeUserIds = new[] { fx.AdminId, fx.InterviewerId } });

        var body = await Json(created);
        Assert.Equal(1, body.GetProperty("shares").GetArrayLength());
        var skipped = Assert.Single(body.GetProperty("skipped").EnumerateArray());
        Assert.Equal(fx.AdminId, skipped.GetProperty("userId").GetInt32());
    }

    [Fact]
    public async Task Validation_problems_are_400_with_a_message()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);
        var token = await RecruiterToken();

        var pastExpiry = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token,
            new { granteeUserIds = new[] { fx.InterviewerId }, expiresAt = DateTime.UtcNow.AddDays(-1) });
        var nobody = await fx.SendAsync(HttpMethod.Post, Url(candidateId), token, new { granteeUserIds = Array.Empty<int>() });

        Assert.Equal(HttpStatusCode.BadRequest, pastExpiry.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(await pastExpiry.Content.ReadAsStringAsync()));
        Assert.Equal(HttpStatusCode.BadRequest, nobody.StatusCode);
    }

    [Fact]
    public async Task Revoking_with_a_mismatched_candidate_id_is_404_and_the_share_stays_active()
    {
        var candidateA = await fx.NewCandidateAsync(fx.RecruiterId);
        var candidateB = await fx.NewCandidateAsync(fx.RecruiterId);
        var token = await RecruiterToken();
        var created = await Json(await fx.SendAsync(HttpMethod.Post, Url(candidateA), token, ShareBody()));
        var shareId = created.GetProperty("shares")[0].GetProperty("id").GetInt32();

        var wrong = await fx.SendAsync(HttpMethod.Delete, $"{Url(candidateB)}/{shareId}", token);

        Assert.Equal(HttpStatusCode.NotFound, wrong.StatusCode);
        var listed = await Json(await fx.SendAsync(HttpMethod.Get, Url(candidateA), token));
        Assert.True(listed[0].GetProperty("isActive").GetBoolean());
    }
}
