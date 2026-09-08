using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MimeKit;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Services;

namespace Recruitment.Gorilla.Tests.Infrastructure;

/// <summary>
/// Base for DB-backed service tests. Each test gets a fresh <see cref="AppDbContext"/> wrapped in a
/// transaction that is rolled back on dispose — the migrate-time seed persists, every test's own writes
/// vanish, so tests are isolated and order-independent without re-migrating. All DB test classes join the
/// "mysql" collection, so they run sequentially (no parallel transactions on the shared database).
/// </summary>
[Collection(MySqlCollection.Name)]
public abstract class DbTestBase : IDisposable
{
    protected readonly AppDbContext Db;
    private readonly IDbContextTransaction _tx;

    protected DbTestBase(MySqlDatabaseFixture fixture)
    {
        Db = fixture.NewContext();
        _tx = Db.Database.BeginTransaction();
        Data = new TestData(Db);
    }

    protected TestData Data { get; }

    // Service factories bound to the transactional context.
    protected CandidateService Candidates() => new(Db, new TestWebHostEnvironment(), Notifications(), TestConfig());
    protected ConfigurationService Config() => new(Db);
    protected InterviewService Interviews() => new(Db, Candidates());
    protected NotificationService Notifications() => new(Db, TestEmail());
    protected AuditService Audit() =>
        new(Db, new CurrentUser(new Microsoft.AspNetCore.Http.HttpContextAccessor()), NullLogger<AuditService>.Instance);
    protected OfferService Offers() => new(Db, Candidates(), Notifications(), Audit(), NullLogger<OfferService>.Instance);
    protected EvaluationRubricService EvaluationRubrics() => new(Db, Audit());
    protected AnalyticsService Analytics() => new(Db);
    protected CandidateDraftService CandidateDrafts(CurrentUser? user = null) =>
        new(Db, Audit(), user ?? new CurrentUser(new Microsoft.AspNetCore.Http.HttpContextAccessor()), NullLogger<CandidateDraftService>.Instance);

    /// <summary>An EmailService whose transport is a no-op — never hits the network, never throws.</summary>
    protected static EmailService TestEmail(ISmtpTransport? transport = null) => new(
        new FixedEmailSettingsResolver(new SmtpOptions { Host = "smtp.test.local", FromAddress = "test@test.local" }),
        transport ?? new NoOpSmtpTransport(),
        NullLogger<EmailService>.Instance);

    protected static IConfiguration TestConfig() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["App:ClientBaseUrl"] = "http://localhost:5173" })
        .Build();

    public void Dispose()
    {
        _tx.Rollback();
        _tx.Dispose();
        Db.Dispose();
        GC.SuppressFinalize(this);
    }
}

/// <summary>Discards every message — used wherever a test needs an EmailService but doesn't assert on sends.</summary>
internal sealed class NoOpSmtpTransport : ISmtpTransport
{
    public Task SendAsync(MimeMessage message, SmtpOptions options, CancellationToken ct = default) => Task.CompletedTask;
}

/// <summary>Returns fixed SMTP options — lets tests build an EmailService without a DB-backed resolver.</summary>
internal sealed class FixedEmailSettingsResolver(SmtpOptions options) : IEmailSettingsResolver
{
    public Task<SmtpOptions> ResolveAsync() => Task.FromResult(options);
}

/// <summary>Minimal IWebHostEnvironment for CandidateService (only ContentRootPath is used, for CV file paths).</summary>
internal sealed class TestWebHostEnvironment : IWebHostEnvironment
{
    public string ApplicationName { get; set; } = "Recruitment.Gorilla.Tests";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = Path.GetTempPath();
    public string EnvironmentName { get; set; } = "Testing";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string WebRootPath { get; set; } = Path.GetTempPath();
}
