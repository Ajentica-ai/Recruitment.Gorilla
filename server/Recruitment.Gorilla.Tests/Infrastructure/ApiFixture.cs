using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;

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
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}
