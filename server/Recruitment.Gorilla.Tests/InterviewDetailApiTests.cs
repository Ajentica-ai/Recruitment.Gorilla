using System.Net;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The real HTTP pipeline for GET /api/interviews/{id}. The service-level rules are covered in
/// <see cref="InterviewServiceEvaluationTests"/>; this proves the response that actually reaches an
/// interviewer's browser carries no candidate timeline (issue #116), which is the thing that leaked.
/// </summary>
[Collection(ApiCollection.Name)]
public class InterviewDetailApiTests(ApiFixture fx)
{
    private async Task<JsonElement> GetAsync(int interviewId, string email, HttpStatusCode expected)
    {
        var resp = await fx.SendAsync(HttpMethod.Get, $"/api/interviews/{interviewId}", await fx.LoginAsync(email));
        Assert.Equal(expected, resp.StatusCode);
        return resp.IsSuccessStatusCode
            ? JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement.Clone()
            : default;
    }

    [Fact]
    public async Task Assigned_interviewer_gets_the_interview_without_the_candidates_timeline()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync();

        var body = await GetAsync(interviewId, fx.InterviewerEmail, HttpStatusCode.OK);

        var candidate = body.GetProperty("candidate");
        Assert.Empty(candidate.GetProperty("statusHistory").EnumerateArray());
        // The profile the page renders is still populated.
        Assert.False(string.IsNullOrWhiteSpace(candidate.GetProperty("fullName").GetString()));
    }

    [Fact]
    public async Task Admin_still_gets_the_timeline()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync();

        var body = await GetAsync(interviewId, fx.AdminEmail, HttpStatusCode.OK);

        Assert.NotEmpty(body.GetProperty("candidate").GetProperty("statusHistory").EnumerateArray());
    }

    [Fact]
    public async Task An_interview_the_caller_is_not_assigned_to_is_not_found()
    {
        var interviewId = await fx.NewInterviewWithHistoryAsync(assignInterviewer: false);

        await GetAsync(interviewId, fx.InterviewerEmail, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Anonymous_is_refused()
    {
        var resp = await fx.SendAsync(HttpMethod.Get, "/api/interviews/1", token: null);
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
