using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The real HTTP pipeline for the role-assignment check on POST/PUT /api/candidates (#97): a
/// Recruiter may only file or reassign a candidate to a job opening they are an assigned
/// recruiter of. The service-level rule (including the "only when changed" update behavior) is
/// covered in <see cref="CandidateServiceAccessTests"/>; this proves the controller surfaces it.
/// </summary>
[Collection(ApiCollection.Name)]
public class CandidateRoleAssignmentApiTests(ApiFixture fx)
{
    private const string Refusal = "You are not assigned to this job opening.";

    private async Task<HttpResponseMessage> CreateAsync(string token, string storedFileName, int? roleId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/candidates")
        {
            Content = JsonContent.Create(new
            {
                fullName = "Role Assignment Check",
                email = $"{Guid.NewGuid():N}@test.local",
                relevantExperience = "3 Years",
                isReferred = false,
                storedFileName,
                originalFileName = "resume.pdf",
                fileType = "PDF",
                fileSizeBytes = 1,
                initialStatus = "Uploaded",
                allowDuplicate = true,
                roleAppliedOptionId = roleId,
            }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await fx.Client.SendAsync(request);
    }

    [Fact]
    public async Task A_recruiter_cannot_create_a_candidate_for_a_role_they_are_not_assigned_to()
    {
        var unassignedRole = await fx.NewRoleAsync();
        var ownUpload = await fx.NewDraftAsync(fx.RecruiterId);

        var response = await CreateAsync(await fx.LoginAsync(fx.RecruiterEmail), ownUpload, unassignedRole);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(Refusal, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_admin_can_create_a_candidate_for_any_role()
    {
        var unassignedRole = await fx.NewRoleAsync();
        var upload = await fx.NewDraftAsync(fx.AdminId);

        var response = await CreateAsync(await fx.LoginAsync(fx.AdminEmail), upload, unassignedRole);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task A_recruiter_can_create_a_candidate_for_their_assigned_role()
    {
        var assignedRole = await fx.NewRoleAsync(recruiterUserIds: [fx.RecruiterId]);
        var ownUpload = await fx.NewDraftAsync(fx.RecruiterId);

        var response = await CreateAsync(await fx.LoginAsync(fx.RecruiterEmail), ownUpload, assignedRole);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task A_recruiter_cannot_reassign_a_candidate_to_a_role_they_are_not_assigned_to()
    {
        var candidateId = await fx.NewCandidateAsync(fx.RecruiterId);
        var unassignedRole = await fx.NewRoleAsync();

        var response = await fx.SendAsync(HttpMethod.Put, $"/api/candidates/{candidateId}", await fx.LoginAsync(fx.RecruiterEmail), new
        {
            fullName = "Reassign Check",
            email = $"{Guid.NewGuid():N}@test.local",
            relevantExperience = "3 Years",
            isReferred = false,
            roleAppliedOptionId = unassignedRole,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(Refusal, await response.Content.ReadAsStringAsync());
    }
}
