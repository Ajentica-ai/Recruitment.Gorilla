using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// The real HTTP pipeline for the JSON import (multipart entry + CV) and the template download, plus the
/// plain CV upload that now shares its file checks. Each test that stores a CV deletes it afterwards,
/// because the API under test writes into its real Uploads folder.
/// </summary>
[Collection(ApiCollection.Name)]
public class CandidateImportApiTests(ApiFixture fx)
{
    private static MultipartFormDataContent Form(string entryJson, byte[] bytes, string fileName)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        return new MultipartFormDataContent
        {
            { new StringContent(entryJson), "entry" },
            { file, "file", fileName },
        };
    }

    private static string Entry(string cvFileName) => $$"""
        // comments are allowed in an entry
        {
          "cvFileName": "{{cvFileName}}",
          "fullName": "Jane Import",
          "email": "{{Guid.NewGuid():N}}@test.com",
          "skills": ["C#", "SQL"],
        }
        """;

    private async Task<(HttpResponseMessage Response, JsonElement Body)> ImportAsync(
        string token, string entryJson, byte[] bytes, string fileName)
    {
        var resp = await fx.SendMultipartAsync("/api/candidate-import", token, Form(entryJson, bytes, fileName));
        var text = await resp.Content.ReadAsStringAsync();
        var body = resp.IsSuccessStatusCode ? JsonDocument.Parse(text).RootElement.Clone() : default;
        if (resp.IsSuccessStatusCode)
            fx.DeleteStoredUpload(body.GetProperty("draft").GetProperty("storedFileName").GetString()!);
        return (resp, body);
    }

    private Task<string> SuperAdmin() => fx.LoginAsync(fx.SuperAdminEmail);

    [Fact]
    public async Task Import_creates_a_pending_draft_from_the_entry()
    {
        var (resp, body) = await ImportAsync(await SuperAdmin(), Entry("jane.pdf"),
            ApiFixture.MinimalPdf($"Import {Guid.NewGuid()}"), "jane.pdf");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var draft = body.GetProperty("draft");
        Assert.True(draft.GetProperty("id").GetInt32() > 0);
        Assert.Equal("Jane Import", draft.GetProperty("fullName").GetString());
        Assert.Equal("C#, SQL", draft.GetProperty("skills").GetString());
        Assert.Equal("jane.pdf", draft.GetProperty("originalFileName").GetString());
    }

    [Fact]
    public async Task Import_refuses_a_cv_that_does_not_match_cvFileName()
    {
        var (resp, _) = await ImportAsync(await SuperAdmin(), Entry("someone-else.pdf"),
            ApiFixture.MinimalPdf($"Import {Guid.NewGuid()}"), "jane.pdf");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("does not match", await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Import_refuses_a_file_type_other_than_pdf_or_docx()
    {
        var (resp, _) = await ImportAsync(await SuperAdmin(), Entry("cv.txt"), "plain text"u8.ToArray(), "cv.txt");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Import_refuses_a_file_whose_content_is_not_a_pdf()
    {
        var (resp, _) = await ImportAsync(await SuperAdmin(), Entry("renamed.pdf"), "not really a pdf"u8.ToArray(), "renamed.pdf");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("not a PDF", await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Import_refuses_an_entry_that_fails_validation()
    {
        var (resp, _) = await ImportAsync(await SuperAdmin(), """{ "cvFileName": "a.pdf", "fullName": "Jane", "email": "nope" }""",
            ApiFixture.MinimalPdf($"Import {Guid.NewGuid()}"), "a.pdf");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("email", await resp.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Import_refuses_the_same_cv_twice()
    {
        var token = await SuperAdmin();
        var bytes = ApiFixture.MinimalPdf($"Import {Guid.NewGuid()}");

        var (first, _) = await ImportAsync(token, Entry("dup.pdf"), bytes, "dup.pdf");
        var (second, _) = await ImportAsync(token, Entry("dup.pdf"), bytes, "dup.pdf");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task Template_downloads_as_a_json_attachment()
    {
        var resp = await fx.SendAsync(HttpMethod.Get, "/api/candidate-import/template", await SuperAdmin());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        Assert.Equal("application/json", resp.Content.Headers.ContentType?.MediaType);
        Assert.Equal("candidate-import-template.json", resp.Content.Headers.ContentDisposition?.FileNameStar
            ?? resp.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        Assert.Contains("MANDATORY FIELDS", await resp.Content.ReadAsStringAsync());
    }

    // The CV upload now goes through the shared intake; it had no multipart test before.
    [Fact]
    public async Task Cv_upload_still_stores_and_parses_a_pdf()
    {
        var file = new ByteArrayContent(ApiFixture.MinimalPdf($"Upload {Guid.NewGuid()}"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        var form = new MultipartFormDataContent { { file, "file", "upload_probe.pdf" } };

        var resp = await fx.SendMultipartAsync("/api/cvupload", await fx.LoginAsync(fx.AdminEmail), form);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var storedName = doc.RootElement.GetProperty("storedFileName").GetString()!;
        fx.DeleteStoredUpload(storedName);
        Assert.Equal("PDF", doc.RootElement.GetProperty("fileType").GetString());
        Assert.True(doc.RootElement.GetProperty("id").GetInt32() > 0);
    }
}
