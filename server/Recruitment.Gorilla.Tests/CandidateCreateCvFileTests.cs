using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The real HTTP pipeline for the CV reference check on POST /api/candidates. The service-level rule
/// is covered in <see cref="CvFileReferenceTests"/>; this proves the controller actually applies it.
/// </summary>
[Collection(ApiCollection.Name)]
public class CandidateCreateCvFileTests(ApiFixture fx)
{
    private const string Refusal = "not one you uploaded";

    private sealed record CreatedCvFile(string OriginalFileName, string FileType, long FileSizeBytes);
    private sealed record CreatedCandidate(int Id, List<CreatedCvFile> CvFiles);

    /// <summary>
    /// A body that passes every earlier check, so the CV reference is what decides the answer. The
    /// file details deliberately disagree with what the tests' drafts record.
    /// </summary>
    private async Task<HttpResponseMessage> CreateAsync(string token, string storedFileName)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/candidates")
        {
            Content = JsonContent.Create(new
            {
                fullName = "Reference Check",
                email = $"{Guid.NewGuid():N}@test.local",
                relevantExperience = "3 Years",
                isReferred = false,
                storedFileName,
                originalFileName = "renamed.docx",
                fileType = "DOCX",
                fileSizeBytes = 1,
                initialStatus = "Uploaded",
                allowDuplicate = true,
            }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await fx.Client.SendAsync(request);
    }

    [Fact]
    public async Task Creating_a_candidate_with_a_cv_name_the_server_did_not_issue_is_refused()
    {
        var response = await CreateAsync(await fx.LoginAsync(fx.AdminEmail), "not-a-server-issued-name.pdf");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        // The specific refusal, so a 400 from some other validation cannot pass this test.
        Assert.Contains(Refusal, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_recruiter_cannot_create_a_candidate_from_another_users_upload()
    {
        var adminsUpload = await fx.NewDraftAsync(fx.AdminId);

        var response = await CreateAsync(await fx.LoginAsync(fx.RecruiterEmail), adminsUpload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(Refusal, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_recruiter_can_create_a_candidate_from_their_own_upload_with_the_uploads_file_details()
    {
        var ownUpload = await fx.NewDraftAsync(fx.RecruiterId, fileType: "PDF", fileSizeBytes: 2048);

        var response = await CreateAsync(await fx.LoginAsync(fx.RecruiterEmail), ownUpload);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedCandidate>();
        var file = Assert.Single(created!.CvFiles);
        // Taken from the draft the server recorded at upload, not from the request body.
        Assert.Equal("cv.pdf", file.OriginalFileName);
        Assert.Equal("PDF", file.FileType);
        Assert.Equal(2048, file.FileSizeBytes);
    }

    [Fact]
    public async Task An_upload_already_attached_to_a_candidate_cannot_back_a_second_one()
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var upload = await fx.NewDraftAsync(fx.AdminId);
        Assert.Equal(HttpStatusCode.Created, (await CreateAsync(token, upload)).StatusCode);

        var second = await CreateAsync(token, upload);

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains(Refusal, await second.Content.ReadAsStringAsync());
    }
}
