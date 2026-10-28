using System.Net;
using System.Net.Http.Headers;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// A file that passes the signature check but is damaged inside is a 400, not an unhandled 500 (#236).
/// <see cref="CVParserService.Parse"/> throws straight from PdfPig / OpenXml on content it cannot read; the
/// controller used to let that bubble up uncaught.
/// </summary>
[Collection(ApiCollection.Name)]
public class CVUploadParseFailureTests(ApiFixture fx)
{
    private static MultipartFormDataContent Form(string fileName, byte[] bytes, string contentType, int roleId)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent
        {
            { file, "file", fileName },
            { new StringContent(roleId.ToString()), "roleAppliedOptionId" },
        };
    }

    [Fact]
    public async Task A_pdf_signed_file_with_damaged_content_is_a_400_and_leaves_nothing_behind()
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var before = fx.UploadedFileNames();
        var batchId = Guid.NewGuid().ToString("N");
        var form = Form($"broken_{Guid.NewGuid():N}.pdf", "%PDF-1.4 not actually a pdf"u8.ToArray(), "application/pdf", fx.RoleId);
        form.Add(new StringContent(batchId), "batchId");

        var resp = await fx.SendMultipartAsync("/api/cvupload", token, form);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("could not be read", await resp.Content.ReadAsStringAsync());
        Assert.Equal(before, fx.UploadedFileNames());
        Assert.Equal(0, await fx.CandidateDraftCountAsync(batchId));
    }

    [Fact]
    public async Task A_zip_signed_docx_with_damaged_content_is_a_400_and_leaves_nothing_behind()
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var before = fx.UploadedFileNames();
        var batchId = Guid.NewGuid().ToString("N");
        var bytes = new byte[] { 0x50, 0x4B, 0x03, 0x04 }.Concat("not a real docx package"u8.ToArray()).ToArray();
        var form = Form($"broken_{Guid.NewGuid():N}.docx", bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fx.RoleId);
        form.Add(new StringContent(batchId), "batchId");

        var resp = await fx.SendMultipartAsync("/api/cvupload", token, form);

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("could not be read", await resp.Content.ReadAsStringAsync());
        Assert.Equal(before, fx.UploadedFileNames());
        Assert.Equal(0, await fx.CandidateDraftCountAsync(batchId));
    }

    [Fact]
    public async Task A_readable_pdf_still_uploads_successfully()
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var name = $"ok_{Guid.NewGuid():N}.pdf";
        var form = Form(name, ApiFixture.MinimalPdf($"Readable {Guid.NewGuid()}"), "application/pdf", fx.RoleId);

        var resp = await fx.SendMultipartAsync("/api/cvupload", token, form);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = System.Text.Json.JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        fx.DeleteStoredUpload(doc.RootElement.GetProperty("storedFileName").GetString()!);
    }
}
