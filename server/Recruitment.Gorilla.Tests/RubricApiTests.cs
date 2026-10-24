using System.Net;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// A candidate under a job opening with its own rubric, created the way the UI creates one (the opening
/// link set, the legacy AppliedRole null), over the real HTTP pipeline (#188).
/// </summary>
[Collection(ApiCollection.Name)]
public class RubricApiTests(ApiFixture fx)
{
    [Fact]
    public async Task The_openings_rubric_is_served_and_accepted_for_a_candidate_linked_only_by_opening()
    {
        const string key = "ApiOpeningKey";
        var roleId = await fx.NewRoleWithRubricAsync(key);
        var candidateId = await fx.NewCandidateAsync(fx.AdminId, roleId); // AppliedRole stays null
        var interviewId = await fx.NewInterviewAsync(candidateId, fx.InterviewerId);
        var token = await fx.LoginAsync(fx.InterviewerEmail);

        var rubric = await fx.SendAsync(HttpMethod.Get, $"/api/evaluation-rubrics/for-interview/{interviewId}", token);
        Assert.Equal(HttpStatusCode.OK, rubric.StatusCode);
        using (var doc = JsonDocument.Parse(await rubric.Content.ReadAsStringAsync()))
        {
            var keys = doc.RootElement.GetProperty("criteria").EnumerateArray()
                .Select(c => c.GetProperty("key").GetString()).ToList();
            Assert.Equal([key], keys);
        }

        var submit = await fx.SendAsync(HttpMethod.Put, $"/api/interviews/{interviewId}/evaluation", token, new
        {
            generalAssessment = "ok", recommendation = "Recommended", overallRating = 4,
            items = new[] { new { criterionKey = key, rating = 4, comment = (string?)null } },
            submit = true,
        });
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);

        // A key from the default rubric is not part of this opening's rubric.
        var other = await fx.NewInterviewAsync(candidateId, fx.InterviewerId);
        var refused = await fx.SendAsync(HttpMethod.Put, $"/api/interviews/{other}/evaluation", token, new
        {
            recommendation = "Recommended", overallRating = 4,
            items = new[] { new { criterionKey = "RelevanceOfExperience", rating = 4, comment = (string?)null } },
            submit = false,
        });
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }
}
