using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The CV a new candidate points at must be one the caller uploaded. The stored name arrives in the
/// request body and used to be saved as given, with nothing tying it to the caller's own upload.
/// </summary>
public class CvFileReferenceTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private const string Refused = "That CV file is not one you uploaded. Upload the CV again and retry.";

    /// <summary>A pending draft uploaded by <paramref name="uploaderId"/>, with a server-style name.</summary>
    private string DraftUploadedBy(int uploaderId)
    {
        var storedName = $"{Guid.NewGuid()}.pdf";
        Db.CandidateDrafts.Add(new CandidateDraft
        {
            OriginalFileName = "cv.pdf",
            StoredFileName = storedName,
            UploadedByUserId = uploaderId,
        });
        Db.SaveChanges();
        return storedName;
    }

    [Fact]
    public async Task A_recruiter_may_reference_their_own_upload()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var name = DraftUploadedBy(recruiter.Id);

        Assert.Null(await Candidates().ValidateCvFileAsync(name, isPrivileged: false, recruiter.Id));
    }

    [Fact]
    public async Task A_recruiter_may_not_reference_another_users_upload()
    {
        var name = DraftUploadedBy(Data.AddUser(Roles.Recruiter).Id);
        var other = Data.AddUser(Roles.Recruiter);

        Assert.Equal(Refused, await Candidates().ValidateCvFileAsync(name, isPrivileged: false, other.Id));
    }

    [Fact]
    public async Task An_admin_may_reference_any_upload()
    {
        var name = DraftUploadedBy(Data.AddUser(Roles.Recruiter).Id);

        Assert.Null(await Candidates().ValidateCvFileAsync(name, isPrivileged: true, Data.AddUser(Roles.Admin).Id));
    }

    [Fact]
    public async Task A_name_the_server_did_not_issue_is_refused_even_for_an_admin()
    {
        Assert.Equal(Refused, await Candidates().ValidateCvFileAsync("probe.pdf", isPrivileged: true, 1));
    }

    [Fact]
    public async Task A_well_formed_name_with_no_upload_behind_it_is_refused()
    {
        var unknown = $"{Guid.NewGuid()}.pdf";

        Assert.Equal(Refused, await Candidates().ValidateCvFileAsync(unknown, isPrivileged: true, 1));
    }

    [Fact]
    public async Task An_upload_already_attached_to_a_candidate_is_refused()
    {
        var recruiter = Data.AddUser(Roles.Recruiter);
        var name = DraftUploadedBy(recruiter.Id);
        var candidate = Data.AddCandidate(recruiter.Id);
        Db.CVFiles.Add(new CVFile { CandidateId = candidate.Id, OriginalFileName = "cv.pdf", StoredFileName = name, FileType = "PDF" });
        Db.SaveChanges();

        // Deleting either candidate would remove the one shared file from disk.
        Assert.Equal(Refused, await Candidates().ValidateCvFileAsync(name, isPrivileged: true, recruiter.Id));
    }

    [Fact]
    public async Task It_fails_closed_for_a_non_admin_with_no_user_id()
    {
        var name = DraftUploadedBy(Data.AddUser(Roles.Recruiter).Id);

        Assert.Equal(Refused, await Candidates().ValidateCvFileAsync(name, isPrivileged: false, userId: null));
    }
}
