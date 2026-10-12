using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The real HTTP pipeline for the candidate-create 409 disclosure fix (#98): the caller always
/// learns a duplicate email exists, but the candidate record itself is only included when the
/// caller's own access scope covers that candidate. Service-level coverage (including the
/// assigned-role case) is in <see cref="CandidateServiceAccessTests"/>; this proves the
/// controller's JSON body actually withholds the record for an out-of-scope caller.
/// </summary>
[Collection(ApiCollection.Name)]
public class CandidateDuplicateDisclosureApiTests(ApiFixture fx)
{
    private async Task<HttpResponseMessage> CreateAsync(string token, string storedFileName, string email)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/candidates")
        {
            Content = JsonContent.Create(new
            {
                fullName = "Duplicate Attempt",
                email,
                relevantExperience = "3 Years",
                isReferred = false,
                storedFileName,
                originalFileName = "resume.pdf",
                fileType = "PDF",
                fileSizeBytes = 1,
                initialStatus = "Uploaded",
                allowDuplicate = false,
            }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await fx.Client.SendAsync(request);
    }

    [Fact]
    public async Task Out_of_scope_recruiter_gets_a_generic_409_with_no_candidate_data()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        var existingId = await fx.NewCandidateAsync(fx.AdminId, email: email); // owned by Admin, no shared role
        var upload = await fx.NewDraftAsync(fx.RecruiterId);

        var response = await CreateAsync(await fx.LoginAsync(fx.RecruiterEmail), upload, email);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.TryGetProperty("existing", out var existing) && existing.ValueKind != JsonValueKind.Null);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(existingId.ToString(), raw);
    }

    [Fact]
    public async Task Admin_gets_the_full_duplicate_record()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        var existingId = await fx.NewCandidateAsync(fx.RecruiterId, email: email);
        var upload = await fx.NewDraftAsync(fx.AdminId);

        var response = await CreateAsync(await fx.LoginAsync(fx.AdminEmail), upload, email);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("existing", out var existing) && existing.ValueKind == JsonValueKind.Object);
        Assert.Equal(existingId, existing.GetProperty("id").GetInt32());
    }
}
