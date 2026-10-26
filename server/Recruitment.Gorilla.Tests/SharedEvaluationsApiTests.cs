using System.Net;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// /api/shared-evaluations over the real HTTP pipeline (#184): any authenticated role may call it,
/// access comes only from an active grant, a revoked grant stops working at once, drafts and
/// out-of-grant rounds never appear, and the existing endpoints are not widened.
/// </summary>
[Collection(ApiCollection.Name)]
public class SharedEvaluationsApiTests(ApiFixture fx)
{
    private static string Shared(string path) => $"/api/shared-evaluations/{path}";
    private static string Shares(int candidateId) => $"/api/candidates/{candidateId}/evaluation-shares";

    private Task<string> InterviewerToken() => fx.LoginAsync(fx.InterviewerEmail);
    private Task<string> AdminToken() => fx.LoginAsync(fx.AdminEmail);

    private static async Task<JsonElement> Json(HttpResponseMessage resp)
    {
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    /// <summary>Shares through the real endpoint as the Admin and returns the share id.</summary>
    private async Task<int> ShareAsync(int candidateId, params int[] interviewIds)
    {
        var resp = await fx.SendAsync(HttpMethod.Post, Shares(candidateId), await AdminToken(),
            new { granteeUserIds = new[] { fx.InterviewerId }, interviewIds });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        return (await Json(resp)).GetProperty("shares")[0].GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Anonymous_callers_get_401_on_all_four_endpoints()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);

        foreach (var path in new[] { "mine", $"candidates/{id}", $"candidates/{id}/profile", $"candidates/{id}/cv/1" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await fx.SendAsync(HttpMethod.Get, Shared(path), token: null)).StatusCode);
    }

    [Fact]
    public async Task Without_a_grant_everything_is_404_and_mine_is_empty()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true);
        var token = await InterviewerToken();

        foreach (var path in new[] { $"candidates/{id}", $"candidates/{id}/profile", $"candidates/{id}/cv/1" })
            Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Shared(path), token)).StatusCode);

        var mine = await Json(await fx.SendAsync(HttpMethod.Get, Shared("mine"), token));
        Assert.DoesNotContain(mine.EnumerateArray(), m => m.GetProperty("candidateId").GetInt32() == id);
    }

    [Fact]
    public async Task A_grantee_reads_the_submitted_report_but_never_drafts()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true, overallRating: 5);
        await fx.AddEvaluationAsync(interviewId, fx.RecruiterId, submitted: false, overallRating: 1);
        await ShareAsync(id);

        var resp = await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), await InterviewerToken());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var report = await Json(resp);
        Assert.Equal(1, report.GetProperty("evaluations").GetArrayLength());
        Assert.Equal(5, report.GetProperty("summary").GetProperty("averageOverall").GetDouble());
    }

    [Fact]
    public async Task An_interview_specific_grant_leaves_other_rounds_out_of_the_report_and_its_averages()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var shared = await fx.NewInterviewAsync(id, fx.AdminId);
        var other = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(shared, fx.AdminId, submitted: true, overallRating: 5);
        await fx.AddEvaluationAsync(other, fx.AdminId, submitted: true, overallRating: 1);
        await ShareAsync(id, shared);

        var report = await Json(await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), await InterviewerToken()));

        var only = Assert.Single(report.GetProperty("evaluations").EnumerateArray());
        Assert.Equal(shared, only.GetProperty("interviewId").GetInt32());
        Assert.Equal(5, report.GetProperty("summary").GetProperty("averageOverall").GetDouble());
    }

    [Fact]
    public async Task A_revoked_grant_stops_working_immediately()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true);
        var shareId = await ShareAsync(id);
        var token = await InterviewerToken();
        Assert.Equal(HttpStatusCode.OK, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), token)).StatusCode);

        var revoke = await fx.SendAsync(HttpMethod.Delete, $"{Shares(id)}/{shareId}", await AdminToken());
        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), token)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}/profile"), token)).StatusCode);
        var mine = await Json(await fx.SendAsync(HttpMethod.Get, Shared("mine"), token));
        Assert.DoesNotContain(mine.EnumerateArray(), m => m.GetProperty("candidateId").GetInt32() == id);
    }

    [Fact]
    public async Task Mine_lists_the_share_with_scope_note_and_the_visible_evaluation_count()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true);
        await fx.AddEvaluationAsync(interviewId, fx.RecruiterId, submitted: false);
        var send = await fx.SendAsync(HttpMethod.Post, Shares(id), await AdminToken(),
            new { granteeUserIds = new[] { fx.InterviewerId }, note = "round 2 prep" });
        Assert.Equal(HttpStatusCode.OK, send.StatusCode);

        var mine = await Json(await fx.SendAsync(HttpMethod.Get, Shared("mine"), await InterviewerToken()));

        var entry = Assert.Single(mine.EnumerateArray(), m => m.GetProperty("candidateId").GetInt32() == id);
        Assert.True(entry.GetProperty("allRounds").GetBoolean());
        Assert.Equal("round 2 prep", entry.GetProperty("note").GetString());
        Assert.Equal(1, entry.GetProperty("visibleEvaluationCount").GetInt32());
    }

    [Fact]
    public async Task The_profile_has_no_status_history_and_a_missing_cv_file_is_404()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: false);
        var detail = await Json(await fx.SendAsync(HttpMethod.Get, $"/api/interviews/{interviewId}", await AdminToken()));
        var id = detail.GetProperty("candidate").GetProperty("id").GetInt32();
        Assert.True(detail.GetProperty("candidate").GetProperty("statusHistory").GetArrayLength() > 0);
        await ShareAsync(id);
        var token = await InterviewerToken();

        var profile = await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}/profile"), token);

        Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
        Assert.Equal(0, (await Json(profile)).GetProperty("statusHistory").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}/cv/999999"), token)).StatusCode);
    }

    [Fact]
    public async Task A_grant_does_not_widen_the_existing_endpoints()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId);
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true);
        await ShareAsync(id);
        var token = await InterviewerToken();

        // The candidate report is Recruiter+; the interview page is for its panel and Admin+.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await fx.SendAsync(HttpMethod.Get, $"/api/candidates/{id}/evaluation-report", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await fx.SendAsync(HttpMethod.Get, $"/api/interviews/{interviewId}", token)).StatusCode);
    }

    [Fact]
    public async Task A_recruiter_outside_the_candidates_scope_reads_only_through_the_grant()
    {
        var id = await fx.NewCandidateAsync(fx.AdminId); // not the Recruiter's candidate
        var interviewId = await fx.NewInterviewAsync(id, fx.AdminId);
        await fx.AddEvaluationAsync(interviewId, fx.AdminId, submitted: true);
        var token = await fx.LoginAsync(fx.RecruiterEmail);

        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), token)).StatusCode);

        var share = await fx.SendAsync(HttpMethod.Post, Shares(id), await AdminToken(),
            new { granteeUserIds = new[] { fx.RecruiterId } });
        Assert.Equal(HttpStatusCode.OK, share.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await fx.SendAsync(HttpMethod.Get, Shared($"candidates/{id}"), token)).StatusCode);
        // Still no access through the Recruiter's own candidate endpoints.
        Assert.Equal(HttpStatusCode.NotFound, (await fx.SendAsync(HttpMethod.Get, $"/api/candidates/{id}", token)).StatusCode);
    }
}
