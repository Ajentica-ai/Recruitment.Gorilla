using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests.Infrastructure;

/// <summary>
/// One booted API + throwaway MySQL database for the whole integration run, seeded with one user per
/// role (+ a role and a candidate). Exposes an <see cref="HttpClient"/>, a login helper that returns a
/// bearer token, and small row builders for per-test throwaway data. Dropped on dispose.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string Password = "Test@Pass123";

    private ApiFactory _factory = null!;
    public HttpClient Client { get; private set; } = null!;

    public string DatabaseName { get; } = $"RG_ITest_{Guid.NewGuid():N}";

    public string SuperAdminEmail { get; private set; } = "";
    public string AdminEmail { get; private set; } = "";
    public string RecruiterEmail { get; private set; } = "";
    public string InterviewerEmail { get; private set; } = "";
    public int AdminId { get; private set; }
    public int RecruiterId { get; private set; }
    public int RoleId { get; private set; }
    public int CandidateId { get; private set; }

    public async Task InitializeAsync()
    {
        _factory = new ApiFactory(TestConnection.ForDatabase(DatabaseName));
        Client = _factory.CreateClient(); // boots the host → Program.Migrate() creates + migrates the DB

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var sa = SeedUser(db, Roles.SuperAdmin);
        var admin = SeedUser(db, Roles.Admin);
        var recruiter = SeedUser(db, Roles.Recruiter);
        var interviewer = SeedUser(db, Roles.Interviewer);
        await db.SaveChangesAsync();

        SuperAdminEmail = sa.Email;
        AdminEmail = admin.Email;
        RecruiterEmail = recruiter.Email;
        InterviewerEmail = interviewer.Email;
        AdminId = admin.Id;
        RecruiterId = recruiter.Id;

        var role = new RoleAppliedOption
        {
            Name = $"Role-{Guid.NewGuid():N}", SortOrder = 1, IsActive = true,
            EndDate = DateTime.UtcNow.AddDays(30),
        };
        db.RoleAppliedOptions.Add(role);

        db.AuditLogs.Add(new AuditLog
        {
            Timestamp = DateTime.UtcNow,
            ActorUserId = admin.Id,
            ActorName = admin.Name,
            Action = "System.Init",
            Summary = "Seeded initial test audit log",
        });

        await db.SaveChangesAsync();
        RoleId = role.Id;

        CandidateId = await NewCandidateAsync(admin.Id);
    }

    public async Task DisposeAsync()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureDeletedAsync();
        }
        Client.Dispose();
        await _factory.DisposeAsync();
    }

    private static User SeedUser(AppDbContext db, string role)
    {
        var user = new User
        {
            Name = $"{role}-{Guid.NewGuid():N}",
            Email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@test.local",
            PasswordHash = PasswordHasher.Hash(Password),
            MustChangePassword = false,
            IsActive = true,
            Roles = [new UserRole { Role = role }],
        };
        db.Users.Add(user);
        return user;
    }

    /// <summary>Inserts a candidate (committed — the whole DB is dropped at teardown) and returns its id.</summary>
    public async Task<int> NewCandidateAsync(int ownerUserId, int? roleId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var candidate = new Candidate
        {
            FullName = $"Cand-{Guid.NewGuid():N}",
            Email = $"{Guid.NewGuid():N}@test.local",
            RelevantExperience = "3 Years",
            OwnerUserId = ownerUserId,
            RoleAppliedOptionId = roleId,
            CurrentStatus = "Uploaded",
        };
        db.Candidates.Add(candidate);
        await db.SaveChangesAsync();
        return candidate.Id;
    }

    /// <summary>
    /// Inserts a pending CV draft uploaded by <paramref name="uploaderUserId"/> under a server-style
    /// stored name, and returns that name. No file is written; nothing here reads it from disk.
    /// </summary>
    public async Task<string> NewDraftAsync(int uploaderUserId, string fileType = "PDF", long fileSizeBytes = 2048)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var extension = fileType == "PDF" ? ".pdf" : ".docx";
        var draft = new CandidateDraft
        {
            OriginalFileName = $"cv{extension}",
            StoredFileName = $"{Guid.NewGuid()}{extension}",
            FileType = fileType,
            FileSizeBytes = fileSizeBytes,
            UploadedByUserId = uploaderUserId,
        };
        db.CandidateDrafts.Add(draft);
        await db.SaveChangesAsync();
        return draft.StoredFileName;
    }

    /// <summary>Inserts a role and returns its id.</summary>
    public async Task<int> NewRoleAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var role = new RoleAppliedOption
        {
            Name = $"Role-{Guid.NewGuid():N}", SortOrder = 1, IsActive = true,
            EndDate = DateTime.UtcNow.AddDays(30),
        };
        db.RoleAppliedOptions.Add(role);
        await db.SaveChangesAsync();
        return role.Id;
    }

    /// <summary>Logs in via the real endpoint and returns the access token.</summary>
    public async Task<string> LoginAsync(string email, string password = Password)
    {
        var resp = await Client.PostAsJsonAsync("/api/auth/login", new { email, password });
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("token").GetString()!;
    }

    /// <summary>Sends a request with an optional bearer token (null = anonymous).</summary>
    public Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string? token)
    {
        var req = new HttpRequestMessage(method, url);
        if (token is not null)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return Client.SendAsync(req);
    }

    /// <summary>
    /// Sends a request with a JSON body. Needed for gates on POST actions: without a valid body the
    /// action answers 400 before authorization is the deciding factor, which proves nothing.
    /// </summary>
    public Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string? token, object body)
    {
        var req = new HttpRequestMessage(method, url) { Content = JsonContent.Create(body) };
        if (token is not null)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return Client.SendAsync(req);
    }

    /// <summary>Sends a multipart form, as the upload and import endpoints expect, with an optional bearer token.</summary>
    public Task<HttpResponseMessage> SendMultipartAsync(string url, string? token, MultipartFormDataContent form)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
        if (token is not null)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return Client.SendAsync(req);
    }

    /// <summary>
    /// Deletes a file an upload test stored. The API under test writes into its real Uploads folder, so
    /// every test that stores a CV removes it again.
    /// </summary>
    public void DeleteStoredUpload(string storedFileName)
    {
        var env = _factory.Services.GetRequiredService<IWebHostEnvironment>();
        var path = UploadPaths.Resolve(env.ContentRootPath, storedFileName);
        if (path is not null && File.Exists(path)) File.Delete(path);
    }

    /// <summary>
    /// A one-page PDF carrying a single line of text that PdfPig can read. Unique text gives a unique
    /// hash, so the duplicate-CV check never trips across tests. Mirrors minimalPdf in client/e2e/seed.ts.
    /// </summary>
    public static byte[] MinimalPdf(string text)
    {
        var safe = text.Replace("\\", "").Replace("(", "").Replace(")", "");
        var content = $"BT /F1 12 Tf 56 760 Td ({safe}) Tj ET\n";
        string[] objects =
        [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
            $"<< /Length {Encoding.Latin1.GetByteCount(content)} >>\nstream\n{content}endstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        ];
        var pdf = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Length; i++)
        {
            offsets.Add(Encoding.Latin1.GetByteCount(pdf.ToString()));
            pdf.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }
        var xref = Encoding.Latin1.GetByteCount(pdf.ToString());
        pdf.Append($"xref\n0 {objects.Length + 1}\n0000000000 65535 f \n");
        foreach (var off in offsets) pdf.Append($"{off:D10} 00000 n \n");
        pdf.Append($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.Latin1.GetBytes(pdf.ToString());
    }

    /// <summary>Inserts an offer in the given status (committed) and returns its id.</summary>
    public async Task<int> NewOfferAsync(int candidateId, string status = "Draft")
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var offer = new Offer
        {
            CandidateId = candidateId,
            JobTitle = "Engineer",
            BaseSalary = 90000,
            Currency = "USD",
            Status = status,
            CreatedByUserId = AdminId,
        };
        db.Offers.Add(offer);
        await db.SaveChangesAsync();
        return offer.Id;
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}
