using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// What a stored CV file name may be, and where a stored file may live. Pure, no DB.
///
/// A new candidate's CV reference used to be saved exactly as the client sent it. Now only a name the
/// upload endpoint could have issued is accepted, and every path built from a stored name is kept
/// inside the uploads folder.
/// </summary>
public class UploadPathsTests
{
    private static readonly string Root = Path.Combine(Path.GetTempPath(), "rg-upload-paths-test");

    [Fact]
    public void Accepts_the_names_the_upload_endpoint_issues()
    {
        // CVUploadController names every upload $"{Guid.NewGuid()}{ext}".
        Assert.True(UploadPaths.IsStoredName($"{Guid.NewGuid()}.pdf"));
        Assert.True(UploadPaths.IsStoredName($"{Guid.NewGuid()}.docx"));
        Assert.True(UploadPaths.IsStoredName($"{Guid.NewGuid()}.PDF"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("probe.pdf")]                                   // not server-issued
    [InlineData("resume.docx")]
    [InlineData("3f2b8c1e-7d4a-4c9b-9e21-5a6f0d3c8b7e.exe")]    // right shape, wrong extension
    [InlineData("3f2b8c1e-7d4a-4c9b-9e21-5a6f0d3c8b7e")]        // no extension
    [InlineData("3f2b8c1e7d4a4c9b9e215a6f0d3c8b7e.pdf")]        // GUID without hyphens is not what we issue
    [InlineData("sub/3f2b8c1e-7d4a-4c9b-9e21-5a6f0d3c8b7e.pdf")] // carries a directory
    [InlineData("../3f2b8c1e-7d4a-4c9b-9e21-5a6f0d3c8b7e.pdf")]  // carries a parent reference
    public void Refuses_anything_else(string? name) =>
        Assert.False(UploadPaths.IsStoredName(name));

    [Fact]
    public void Resolves_a_stored_name_inside_the_uploads_folder()
    {
        var name = $"{Guid.NewGuid()}.pdf";

        var path = UploadPaths.Resolve(Root, name);

        Assert.NotNull(path);
        Assert.Equal(Path.Combine(Path.GetFullPath(Path.Combine(Root, UploadPaths.FolderName)), name), path);
    }

    [Theory]
    [InlineData("../outside.pdf")]
    [InlineData("../../outside.pdf")]
    public void Refuses_a_path_that_leaves_the_uploads_folder(string storedName) =>
        Assert.Null(UploadPaths.Resolve(Root, storedName));

    [Fact]
    public void Refuses_an_absolute_path()
    {
        // Path.Combine returns its second argument unchanged when that argument is rooted.
        var absolute = Path.Combine(Path.GetPathRoot(Path.GetTempPath())!, "outside.pdf");

        Assert.Null(UploadPaths.Resolve(Root, absolute));
    }

    [Fact]
    public void Gives_null_rather_than_throwing_for_a_name_that_is_not_a_valid_path()
    {
        // Only a bad row already in the DB could carry this; it must not turn a delete into a 500.
        Assert.Null(UploadPaths.Resolve(Root, "bad" + '\0' + "name.pdf"));
    }

    [Fact]
    public void Refuses_the_uploads_folder_itself()
    {
        // Not a file inside it, so there is nothing legitimate to serve or delete.
        Assert.Null(UploadPaths.Resolve(Root, "."));
    }
}
