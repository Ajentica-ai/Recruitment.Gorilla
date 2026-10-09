using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

public class CandidateDraftServiceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    /// <summary>
    /// The service as an Admin, who may see and act on every draft. The persistence tests below are
    /// not about scoping, and used to run as an anonymous caller, which only worked because the draft
    /// scope failed open for a caller without a user id. It fails closed now, so they say who they are.
    /// </summary>
    private CandidateDraftService AsAdmin() =>
        CandidateDrafts(SignedIn(Data.AddUser(Roles.Admin).Id, Roles.Admin));

    private CurrentUser NewRecruiter() => SignedIn(Data.AddUser(Roles.Recruiter).Id, Roles.Recruiter);

    /// <summary>A pending draft uploaded by <paramref name="uploader"/>, who becomes its owner.</summary>
    private async Task<CandidateDraft> DraftUploadedBy(CurrentUser uploader, string tag) =>
        await CandidateDrafts(uploader).CreateDraftAsync(
            $"{tag}.pdf", $"stored_{tag}_{Guid.NewGuid():N}.pdf", "PDF", 1000, $"batch_{tag}", null,
            $"Owner {tag}", $"{tag}@test.com", null, null, null, null, null);

    [Fact]
    public async Task CreateDraft_and_GetDrafts_persists_in_database()
    {
        var service = AsAdmin();
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
        var service = AsAdmin();
        var draft = await service.CreateDraftAsync(
            "jane_doe.pdf", "stored_456.pdf", "PDF", 45000,
            "batch_002", "Design Intake",
            "Jane D", "jane@test.com", null, null, null, null, null
        );

        var (updated, error) = await service.UpdateDraftAsync(draft.Id, new UpdateCandidateDraftDto(
            "Jane Doe", "jane.doe@updated.com", "+1 555 222", "Lead Designer",
            "5 Years", "Figma, React", "Product Designer Bio",
            "linkedin.com/in/janedoe", null, null, null, null, null
        ));

        Assert.Null(error);
        Assert.NotNull(updated);
        Assert.Equal("Jane Doe", updated.FullName);
        Assert.Equal("jane.doe@updated.com", updated.Email);
        Assert.Equal("Lead Designer", updated.CurrentTitle);
        Assert.Equal("5 Years", updated.RelevantExperience);
    }

    [Fact]
    public async Task ApproveDraft_creates_candidate_and_links_cvfile()
    {
        var service = AsAdmin();
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
        var service = AsAdmin();
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
        var service = AsAdmin();
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

    private static string HashOf(string content) =>
        CandidateDraftService.ComputeFileHash(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content)));

    [Fact]
    public async Task FindDuplicateUpload_blocks_a_cv_that_is_pending_review()
    {
        var service = AsAdmin();
        var hash = HashOf($"cv-{Guid.NewGuid()}");
        await service.CreateDraftAsync(
            "pending.pdf", "stored_pending.pdf", "PDF", 1234, "batch_dup", null,
            "Pending Person", "pending@test.com", null, null, null, null, null, fileHash: hash);

        var error = await service.FindDuplicateUploadAsync(hash, 1234);

        Assert.Equal("This CV has already been uploaded and is waiting for review in Drafts.", error);
        Assert.Null(await service.FindDuplicateUploadAsync(HashOf($"other-{Guid.NewGuid()}"), 1234));
    }

    [Fact]
    public async Task FindDuplicateUpload_allows_a_cv_whose_draft_was_discarded()
    {
        var service = AsAdmin();
        var hash = HashOf($"cv-{Guid.NewGuid()}");
        var draft = await service.CreateDraftAsync(
            "discarded.pdf", "stored_discarded.pdf", "PDF", 1234, "batch_dup", null,
            "Discarded Person", "discarded@test.com", null, null, null, null, null, fileHash: hash);
        await service.DiscardDraftAsync(draft.Id);

        Assert.Null(await service.FindDuplicateUploadAsync(hash, 1234));
    }

    [Fact]
    public async Task FindDuplicateUpload_blocks_a_cv_already_attached_to_a_candidate()
    {
        var service = AsAdmin();
        var role = Data.AddRole("Duplicate Check Role");
        var hash = HashOf($"cv-{Guid.NewGuid()}");
        var draft = await service.CreateDraftAsync(
            "approved.pdf", "stored_approved.pdf", "PDF", 1234, "batch_dup", null,
            "Approved Person", "approved@test.com", null, null, null, null, null, fileHash: hash);
        var (candidate, _) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Approved Person", "approved@test.com", null, null, "2 Years", null, null, null, null, null,
            role.Id, null, null));
        Assert.NotNull(candidate);

        var error = await service.FindDuplicateUploadAsync(hash, 1234);

        Assert.Equal("This CV has already been uploaded for an existing candidate.", error);
    }

    [Fact]
    public async Task FindDuplicateUpload_hashes_files_stored_before_hashing_existed()
    {
        var content = System.Text.Encoding.UTF8.GetBytes($"legacy-cv-{Guid.NewGuid()}");
        var storedName = $"{Guid.NewGuid()}.pdf";
        var uploads = Path.Combine(Path.GetTempPath(), "Uploads");
        Directory.CreateDirectory(uploads);
        var path = Path.Combine(uploads, storedName);
        await File.WriteAllBytesAsync(path, content);
        try
        {
            var service = AsAdmin();
            var draft = await service.CreateDraftAsync(
                "legacy.pdf", storedName, "PDF", content.Length, "batch_dup", null,
                "Legacy Person", "legacy@test.com", null, null, null, null, null);
            Assert.Null(draft.FileHash);

            var hash = CandidateDraftService.ComputeFileHash(new MemoryStream(content));
            var error = await service.FindDuplicateUploadAsync(hash, content.Length);

            Assert.Equal("This CV has already been uploaded and is waiting for review in Drafts.", error);
            Assert.Equal(hash, draft.FileHash); // backfilled, so the next check is a plain lookup
        }
        finally
        {
            File.Delete(path);
        }
    }

    // ---- Uploader scoping ----------------------------------------------------------------------
    // The draft list was scoped to its uploader, but every by-id and bulk path loaded drafts by id
    // alone. A Recruiter could read another user's parsed CV, edit it, discard it, or approve it and
    // become the owner of the candidate it produced. Confirmed live for the read path.

    [Fact]
    public async Task A_recruiter_cannot_read_another_users_draft_by_id()
    {
        var owner = NewRecruiter();
        var draft = await DraftUploadedBy(owner, "read");

        Assert.Null(await CandidateDrafts(NewRecruiter()).GetDraftByIdAsync(draft.Id));
        Assert.NotNull(await CandidateDrafts(owner).GetDraftByIdAsync(draft.Id));
    }

    [Fact]
    public async Task An_admin_can_still_read_any_draft()
    {
        var draft = await DraftUploadedBy(NewRecruiter(), "admin-read");

        Assert.NotNull(await AsAdmin().GetDraftByIdAsync(draft.Id));
    }

    [Fact]
    public async Task A_recruiter_cannot_update_approve_or_discard_another_users_draft()
    {
        var owner = NewRecruiter();
        var draft = await DraftUploadedBy(owner, "write");
        var role = Data.AddRole("Scoping Write Role");
        var intruder = CandidateDrafts(NewRecruiter());

        var (updated, updateError) = await intruder.UpdateDraftAsync(draft.Id, new UpdateCandidateDraftDto(
            "Hijacked", "hijack@test.com", null, null, null, null, null, null, null, null, null, null, null));
        var (candidate, error) = await intruder.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Hijacked", "hijack@test.com", null, null, "2 Years", null, null, null, null, null,
            role.Id, null, null));
        var discarded = await intruder.DiscardDraftAsync(draft.Id);

        Assert.Null(updated);
        Assert.Null(updateError);
        Assert.Null(candidate);
        Assert.Equal("Draft not found.", error);
        Assert.False(discarded);

        // And none of it landed: still pending, still the owner's data, and no candidate was made.
        var stored = await CandidateDrafts(owner).GetDraftByIdAsync(draft.Id);
        Assert.NotNull(stored);
        Assert.Equal("Pending", stored.Status);
        Assert.Equal("Owner write", stored.FullName);
        Assert.False(Db.Candidates.Any(c => c.Email == "hijack@test.com"));
    }

    [Fact]
    public async Task Bulk_approve_and_bulk_discard_skip_drafts_the_caller_did_not_upload()
    {
        var owner = NewRecruiter();
        var intruderUser = NewRecruiter();
        var ownersDraft = await DraftUploadedBy(owner, "bulk-owner");
        var intrudersDraft = await DraftUploadedBy(intruderUser, "bulk-intruder");
        var role = Data.AddRole("Scoping Bulk Role");
        var intruder = CandidateDrafts(intruderUser);

        var approved = await intruder.BulkApproveAsync(new BulkApproveDraftsDto([ownersDraft.Id], role.Id));
        var discarded = await intruder.BulkDiscardAsync([ownersDraft.Id, intrudersDraft.Id]);

        Assert.Empty(approved);
        Assert.Equal(1, discarded); // only the intruder's own draft
        Assert.Equal("Pending", (await CandidateDrafts(owner).GetDraftByIdAsync(ownersDraft.Id))!.Status);
    }

    [Fact]
    public async Task Batch_list_shows_only_the_callers_own_batches()
    {
        var owner = NewRecruiter();
        await DraftUploadedBy(owner, "batchscope");

        var forOwner = await CandidateDrafts(owner).GetBatchesAsync();
        var forOther = await CandidateDrafts(NewRecruiter()).GetBatchesAsync();

        Assert.Contains(forOwner, b => b.BatchId == "batch_batchscope");
        Assert.DoesNotContain(forOther, b => b.BatchId == "batch_batchscope");
    }

    [Fact]
    public async Task Duplicate_cv_check_stays_global_across_users()
    {
        // Deliberately outside ScopedDrafts (#93): a CV pending in one user's queue must still
        // block the same file from another user. Pinned here because the Admin-run duplicate
        // tests above would pass even if the check were wrongly scoped.
        var hash = HashOf($"cv-{Guid.NewGuid()}");
        await CandidateDrafts(NewRecruiter()).CreateDraftAsync(
            "shared.pdf", $"stored_shared_{Guid.NewGuid():N}.pdf", "PDF", 1234, "batch_shared", null,
            "Shared Person", "shared@test.com", null, null, null, null, null, fileHash: hash);

        var error = await CandidateDrafts(NewRecruiter()).FindDuplicateUploadAsync(hash, 1234);

        Assert.Equal("This CV has already been uploaded and is waiting for review in Drafts.", error);
    }

    [Fact]
    public async Task A_caller_with_no_user_id_sees_no_drafts()
    {
        // Fails closed. The old list check filtered only when the caller had a user id, so a
        // non-admin caller without one fell through to every draft in the table.
        var draft = await DraftUploadedBy(NewRecruiter(), "anonymous");
        var anonymous = CandidateDrafts();

        var list = await anonymous.GetDraftsAsync(new DraftsFilterQuery(BatchId: "batch_anonymous"));

        Assert.DoesNotContain(list.Items, d => d.Id == draft.Id);
        Assert.Null(await anonymous.GetDraftByIdAsync(draft.Id));
    }

    // ---- Scoping by assigned job opening: a Recruiter can act on a draft they didn't upload, as
    // long as it's for an opening they are assigned to. ----

    [Fact]
    public async Task A_recruiter_can_see_and_approve_a_draft_for_their_assigned_opening()
    {
        var recruiterUser = Data.AddUser(Roles.Recruiter);
        var recruiter = SignedIn(recruiterUser.Id, Roles.Recruiter);
        var role = Data.AddRole("Assigned Opening", null, recruiterUser.Id);

        var draft = await AsAdmin().CreateDraftAsync(
            "assigned.pdf", $"stored_assigned_{Guid.NewGuid():N}.pdf", "PDF", 1000, "batch_assigned", null,
            "Assigned Candidate", "assigned@test.com", null, null, null, null, null,
            roleAppliedOptionId: role.Id);

        var asRecruiter = CandidateDrafts(recruiter);
        Assert.NotNull(await asRecruiter.GetDraftByIdAsync(draft.Id));

        var (candidate, error) = await asRecruiter.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Assigned Candidate", "assigned@test.com", null, null, "2 Years", null, null, null, null, null,
            role.Id, null, null));

        Assert.Null(error);
        Assert.NotNull(candidate);
    }

    [Fact]
    public async Task A_recruiter_cannot_see_a_draft_for_an_opening_they_are_not_assigned_to()
    {
        var recruiter = NewRecruiter();
        var unassignedRole = Data.AddRole("Unassigned Opening");

        var draft = await AsAdmin().CreateDraftAsync(
            "unassigned.pdf", $"stored_unassigned_{Guid.NewGuid():N}.pdf", "PDF", 1000, "batch_unassigned", null,
            "Unassigned Candidate", "unassigned@test.com", null, null, null, null, null,
            roleAppliedOptionId: unassignedRole.Id);

        Assert.Null(await CandidateDrafts(recruiter).GetDraftByIdAsync(draft.Id));
    }

    // ---- Approve validates the job opening itself (existence, active, not expired) ----

    [Fact]
    public async Task ApproveDraft_rejects_a_missing_role()
    {
        var service = AsAdmin();
        var draft = await service.CreateDraftAsync(
            "norole.pdf", "stored_norole.pdf", "PDF", 1000, "batch_norole", null,
            "No Role Candidate", "norole@test.com", null, null, null, null, null);

        var (candidate, error) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "No Role Candidate", "norole@test.com", null, null, "2 Years", null, null, null, null, null,
            null, null, null));

        Assert.Null(candidate);
        Assert.Equal("Select a job opening.", error);
    }

    [Fact]
    public async Task ApproveDraft_rejects_an_inactive_role()
    {
        var service = AsAdmin();
        var role = new RoleAppliedOption
        {
            Name = $"Inactive-{Guid.NewGuid():N}", SortOrder = 1, IsActive = false,
            EndDate = DateTime.UtcNow.AddDays(30),
        };
        Db.RoleAppliedOptions.Add(role);
        await Db.SaveChangesAsync();

        var draft = await service.CreateDraftAsync(
            "inactive.pdf", "stored_inactive.pdf", "PDF", 1000, "batch_inactive", null,
            "Inactive Role Candidate", "inactive@test.com", null, null, null, null, null);

        var (candidate, error) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Inactive Role Candidate", "inactive@test.com", null, null, "2 Years", null, null, null, null, null,
            role.Id, null, null));

        Assert.Null(candidate);
        Assert.Equal("The selected job opening is not open.", error);
    }

    [Fact]
    public async Task ApproveDraft_rejects_an_expired_role()
    {
        var service = AsAdmin();
        var role = Data.AddRole($"Expired-{Guid.NewGuid():N}", DateTime.UtcNow.AddDays(-1));

        var draft = await service.CreateDraftAsync(
            "expired.pdf", "stored_expired.pdf", "PDF", 1000, "batch_expired", null,
            "Expired Role Candidate", "expired@test.com", null, null, null, null, null);

        var (candidate, error) = await service.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            "Expired Role Candidate", "expired@test.com", null, null, "2 Years", null, null, null, null, null,
            role.Id, null, null));

        Assert.Null(candidate);
        Assert.Equal("The selected job opening is not open.", error);
    }

    [Fact]
    public async Task A_recruiter_cannot_move_a_draft_to_an_opening_they_are_not_assigned_to()
    {
        var recruiterUser = Data.AddUser(Roles.Recruiter);
        var recruiter = SignedIn(recruiterUser.Id, Roles.Recruiter);
        var draft = await DraftUploadedBy(recruiter, "switch");
        var unassignedRole = Data.AddRole("Not Mine");

        var asRecruiter = CandidateDrafts(recruiter);

        var (updated, updateError) = await asRecruiter.UpdateDraftAsync(draft.Id, new UpdateCandidateDraftDto(
            draft.FullName, draft.Email, null, null, null, null, null, null, null, null,
            unassignedRole.Id, null, null));
        Assert.Null(updated);
        Assert.Equal("You are not assigned to this job opening.", updateError);

        var (candidate, approveError) = await asRecruiter.ApproveDraftAsync(draft.Id, new ApproveCandidateDraftDto(
            draft.FullName, draft.Email, null, null, "2 Years", null, null, null, null, null,
            unassignedRole.Id, null, null));
        Assert.Null(candidate);
        Assert.Equal("You are not assigned to this job opening.", approveError);
    }
}
