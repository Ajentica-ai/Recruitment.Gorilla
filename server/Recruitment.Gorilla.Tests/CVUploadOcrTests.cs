using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// A scanned PDF has no text layer, so the server cannot read it. The browser OCRs it and sends the text along
/// (#260); the server uses that text only for such files, repairs OCR damage, and marks the draft as read from a scan.
/// </summary>
[Collection(ApiCollection.Name)]
public class CVUploadOcrTests(ApiFixture fx)
{
    // Short enough (< 40 characters) that the server sees no usable text layer, and unique so the duplicate check passes.
    private static byte[] ScanLikePdf() => ApiFixture.MinimalPdf(Guid.NewGuid().ToString("N"));

    private static string OcrCv(string email) => $"""
        Arif Hossain

        Senior Backend Engineer

        Email: {email}

        Phone: +8801700000000

        PROFESSIONAL SUMMARY
        Backend engineer with 8 years of experience building production systems.
        """;

    private async Task<JsonElement> Upload(byte[] pdf, string? ocrText)
    {
        var token = await fx.LoginAsync(fx.AdminEmail);
        var file = new ByteArrayContent(pdf);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        var form = new MultipartFormDataContent
        {
            { file, "file", $"scan_{Guid.NewGuid():N}.pdf" },
            { new StringContent(fx.RoleId.ToString()), "roleAppliedOptionId" },
        };
        if (ocrText is not null) form.Add(new StringContent(ocrText), "ocrText");

        var resp = await fx.SendMultipartAsync("/api/cvupload", token, form);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var root = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement.Clone();
        fx.DeleteStoredUpload(root.GetProperty("storedFileName").GetString()!);
        return root;
    }

    [Fact]
    public async Task A_scanned_pdf_is_filled_from_the_ocr_text_and_marked_as_read_from_a_scan()
    {
        var draft = await Upload(ScanLikePdf(), OcrCv("arif. hossain@example. invalid"));

        Assert.True(draft.GetProperty("readFromScan").GetBoolean());
        Assert.Equal("arif.hossain@example.invalid", draft.GetProperty("email").GetString());
        Assert.Equal("+8801700000000", draft.GetProperty("phone").GetString());
    }

    [Fact]
    public async Task A_pdf_with_its_own_text_ignores_the_ocr_text()
    {
        var ownText = "Jane Doe jane.real@example.com +8801711111111 Senior Software Engineer building production systems";
        var draft = await Upload(ApiFixture.MinimalPdf(ownText + " " + Guid.NewGuid()), OcrCv("ocr.other@example.com"));

        Assert.False(draft.GetProperty("readFromScan").GetBoolean());
        Assert.Equal("jane.real@example.com", draft.GetProperty("email").GetString());
    }

    [Fact]
    public async Task A_scan_without_ocr_text_uploads_as_before_and_is_not_marked()
    {
        var draft = await Upload(ScanLikePdf(), null);

        Assert.False(draft.GetProperty("readFromScan").GetBoolean());
        Assert.Equal(JsonValueKind.Null, draft.GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task Ocr_text_over_the_size_limit_is_ignored_not_rejected()
    {
        var huge = OcrCv("big@example.com") + new string('x', 200_001);
        var draft = await Upload(ScanLikePdf(), huge);

        Assert.False(draft.GetProperty("readFromScan").GetBoolean());
        Assert.Equal(JsonValueKind.Null, draft.GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task Ocr_text_with_almost_no_content_is_ignored()
    {
        var draft = await Upload(ScanLikePdf(), "  tiny  ");

        Assert.False(draft.GetProperty("readFromScan").GetBoolean());
    }

    [Fact]
    public async Task The_saved_draft_remembers_it_was_read_from_a_scan()
    {
        var uploaded = await Upload(ScanLikePdf(), OcrCv("persist@example.com"));
        var id = uploaded.GetProperty("id").GetInt32();

        var token = await fx.LoginAsync(fx.AdminEmail);
        var resp = await fx.SendAsync(HttpMethod.Get, $"/api/candidate-drafts/{id}", token);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var saved = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
        Assert.True(saved.GetProperty("readFromScan").GetBoolean());
    }
}
