using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

public class CandidateDraftServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    [Fact]
    public async Task CreateDraft_and_GetDrafts_persists_in_database()
    {
        var service = CandidateDrafts();
        var draft = await service.CreateDraftAsync(
            "john_doe.pdf", "stored_123.pdf", "PDF", 50000,
            "batch_001", "Q3 Engineering",
            "John Doe", "john.doe@test.com", "+1 555 111",
            "linkedin.com/in/johndoe", "github.com/johndoe",
            "C#, .NET, Azure", "Experienced backend engineer."
        );

        Assert.True(draft.Id > 0);
        Assert.Equal("Pending", draft.Status);

        var queryResult = await service.GetDraftsAsync(new DraftsFilterQuery(Status: "Pending", BatchId: "batch_001"));
        Assert.Contains(queryResult.Items, d => d.Id == draft.Id && d.FullName == "John Doe");
        Assert.True(queryResult.TotalPending >= 1);
    }

    [Fact]
    public async Task UpdateDraft_updates_fields_successfully()
    {
        var service = CandidateDrafts();
        var draft = await service.CreateDraftAsync(
            "jane_doe.pdf", "stored_456.pdf", "PDF", 45000,
            "batch_002", "Design Intake",
            "Jane D", "jane@test.com", null, null, null, null, null
        );

        var updated = await service.UpdateDraftAsync(draft.Id, new UpdateCandidateDraftDto(
            "Jane Doe", "jane.doe@updated.com", "+1 555 222", "Lead Designer",
            "5 Years", "Figma, React", "Product Designer Bio",
            "linkedin.com/in/janedoe", null, null, null, null, null
        ));

        Assert.NotNull(updated);
        Assert.Equal("Jane Doe", updated.FullName);
        Assert.Equal("jane.doe@updated.com", updated.Email);
        Assert.Equal("Lead Designer", updated.CurrentTitle);
        Assert.Equal("5 Years", updated.RelevantExperience);
    }

    [Fact]
    public async Task ApproveDraft_creates_candidate_and_links_cvfile()
    {
        var service = CandidateDrafts();
        var role = Data.AddRole("Senior Developer");

        var draft = await service.CreateDraftAsync(
            "dev_resume.pdf", "stored_dev_789.pdf", "PDF", 60000,
            "batch_003", "Tech Batch",
            "Alex Developer", "alex.dev@test.com", "+1 555 333",
            null, null, "C#, SQL", "Senior dev"
        );

        var (candidate, error) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Alex Developer", "alex.dev@test.com", "+1 555 333", "Senior Dev",
            "6 Years", "C#, SQL", "Senior dev", null, null, null,
            role.Id, null, null
        ));

        Assert.Null(error);
        Assert.NotNull(candidate);
        Assert.True(candidate.Id > 0);
        Assert.Equal("Uploaded", candidate.CurrentStatus);

        // Verify draft is marked Approved
        var updatedDraft = await service.GetDraftByIdAsync(draft.Id);
        Assert.NotNull(updatedDraft);
        Assert.Equal("Approved", updatedDraft.Status);

        // Verify CVFile attached
        var cvFile = Db.CVFiles.FirstOrDefault(f => f.CandidateId == candidate.Id);
        Assert.NotNull(cvFile);
        Assert.Equal("stored_dev_789.pdf", cvFile.StoredFileName);
    }

    [Fact]
    public async Task Create_and_ApproveDraft_transfers_Education_Experience_and_Profiles()
    {
        var service = CandidateDrafts();
        var role = Data.AddRole("Full Stack Engineer BD Test");

        var educations = new List<ParsedEducation>
        {
            new("BSc in Computer Science & Engineering", "Bangladesh University of Engineering and Technology (BUET)", "2023", "3.85")
        };

        var experiences = new List<ParsedExperience>
        {
            new("Software Engineer", "Brain Station 23", "Jan 2023 - Present", "Built .NET & React microservices.")
        };

        var draft = await service.CreateDraftAsync(
            "tahmid_cv.pdf", "stored_tahmid.pdf", "PDF", 75000,
            "batch_bd_01", "Dhaka CSE Batch",
            "Tahmid Rahman", "tahmid@test.com", "+880 1711-223344",
            "https://linkedin.com/in/tahmid-r", "https://github.com/tahmid-r",
            "C#, .NET, React, TypeScript, SQL", "Full stack engineer in Dhaka.",
            "Dhaka, Bangladesh",
            "https://leetcode.com/u/tahmid_code",
            "https://codeforces.com/profile/tahmid_cf",
            "https://hackerrank.com/profile/tahmid_hr",
            "https://gitlab.com/tahmid_gl",
            educations,
            experiences
        );

        Assert.NotNull(draft.EducationJson);
        Assert.NotNull(draft.ExperienceJson);
        Assert.Equal("Dhaka, Bangladesh", draft.Location);
        Assert.Equal("https://leetcode.com/u/tahmid_code", draft.LeetCodeUrl);

        var (candidate, error) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            draft.FullName, draft.Email, draft.Phone, "Full Stack Engineer",
            "2 Years", draft.Skills, draft.Summary, draft.LinkedInUrl, draft.GithubUrl, draft.PortfolioUrl,
            role.Id, null, null, null, false, null, null, null,
            draft.Location, draft.LeetCodeUrl, draft.CodeforcesUrl, draft.HackerRankUrl, draft.GitLabUrl
        ));

        Assert.Null(error);
        Assert.NotNull(candidate);

        // Fetch candidate detail via CandidateService to verify eager loading
        var candidateDetail = await Candidates().GetByIdAsync(candidate.Id);
        Assert.NotNull(candidateDetail);
        Assert.Equal("Dhaka, Bangladesh", candidateDetail.Location);
        Assert.Equal("https://leetcode.com/u/tahmid_code", candidateDetail.LeetCodeUrl);
        Assert.Equal("https://codeforces.com/profile/tahmid_cf", candidateDetail.CodeforcesUrl);
        Assert.Equal("https://hackerrank.com/profile/tahmid_hr", candidateDetail.HackerRankUrl);
        Assert.Equal("https://gitlab.com/tahmid_gl", candidateDetail.GitLabUrl);

        Assert.NotNull(candidateDetail.Educations);
        Assert.Single(candidateDetail.Educations);
        Assert.Equal("BSc in Computer Science & Engineering", candidateDetail.Educations[0].Degree);
        Assert.Equal("3.85", candidateDetail.Educations[0].Cgpa);

        Assert.NotNull(candidateDetail.Experiences);
        Assert.Single(candidateDetail.Experiences);
        Assert.Equal("Software Engineer", candidateDetail.Experiences[0].JobTitle);
        Assert.Equal("Brain Station 23", candidateDetail.Experiences[0].Company);
    }

    [Fact]
    public async Task DiscardDraft_marks_status_as_discarded()
    {
        var service = CandidateDrafts();
        var draft = await service.CreateDraftAsync(
            "discard_me.pdf", "stored_discard.pdf", "PDF", 20000,
            "batch_004", "Test Batch",
            "Discard Candidate", "discard@test.com", null, null, null, null, null
        );

        var success = await service.DiscardDraftAsync(draft.Id);
        Assert.True(success);

        var fetched = await service.GetDraftByIdAsync(draft.Id);
        Assert.NotNull(fetched);
        Assert.Equal("Discarded", fetched.Status);
    }
}
