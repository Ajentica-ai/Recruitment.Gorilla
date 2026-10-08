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
using Recruitment.Gorilla.API.Services.Background;

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
    protected ConfigurationService Config() => new(Db, Notifications());
    protected InterviewService Interviews() => new(Db, Candidates(), Notifications());
    protected NotificationService Notifications() => new(Db, TestEmail(), TestSlack());
    protected AuditService Audit() =>
        new(Db, new CurrentUser(new Microsoft.AspNetCore.Http.HttpContextAccessor()), NullLogger<AuditService>.Instance);
    protected OfferService Offers() => new(Db, Candidates(), Notifications(), Audit(), NullLogger<OfferService>.Instance);
    protected EvaluationRubricService EvaluationRubrics() => new(Db, Audit());
    protected AnalyticsService Analytics() => new(Db);
    protected EmailOutboxProcessor OutboxProcessor(IEmailDispatcher? dispatcher = null, TimeProvider? time = null) =>
        new(Db, dispatcher ?? new FixedEmailDispatcher(), time ?? TimeProvider.System, NullLogger<EmailOutboxProcessor>.Instance);
    protected CandidateDraftService CandidateDrafts(CurrentUser? user = null) =>
        new(Db, Audit(), user ?? new CurrentUser(new FixedHttpContextAccessor(null)), new TestWebHostEnvironment(), NullLogger<CandidateDraftService>.Instance);
    protected CandidateImportService CandidateImports(CurrentUser? user = null) =>
        new(Db, CandidateDrafts(user), Candidates(), Audit());

    /// <summary>
    /// A <see cref="CurrentUser"/> signed in as <paramref name="userId"/> with the given roles, built
    /// from the same claims the API issues (<c>sub</c> for the id, one role claim each). Without one, a
    /// service sees an anonymous caller, which is the wrong thing to test anything scoped against.
    ///
    /// Each one holds its own context. The framework's HttpContextAccessor keeps the context in shared
    /// ambient state, so with it every CurrentUser in a test became whoever signed in last, and a
    /// test of one user against another quietly ran both as the same person.
    /// </summary>
    protected static CurrentUser SignedIn(int userId, params string[] roles)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, userId.ToString()),
        };
        claims.AddRange(roles.Select(r => new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, r)));

        var principal = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(claims, authenticationType: "Test"));
        return new CurrentUser(new FixedHttpContextAccessor(
            new Microsoft.AspNetCore.Http.DefaultHttpContext { User = principal }));
    }

    /// <summary>An accessor that returns the one context it was given, unaffected by any other.</summary>
    private sealed class FixedHttpContextAccessor(Microsoft.AspNetCore.Http.HttpContext? context)
        : Microsoft.AspNetCore.Http.IHttpContextAccessor
    {
        public Microsoft.AspNetCore.Http.HttpContext? HttpContext { get; set; } = context;
    }

    /// <summary>
    /// An EmailService bound to this test's transactional context, with a no-op transport by default.
    /// <see cref="EmailService.SendAsync"/> only writes the <c>OutboundEmails</c> row — nothing reaches
    /// the network unless the test also runs it through <see cref="OutboxProcessor"/>.
    /// </summary>
    protected EmailService TestEmail(ISmtpTransport? transport = null) => new(
        Db,
        new EmailDispatcher(
            new FixedEmailSettingsResolver(new SmtpOptions { Host = "smtp.test.local", FromAddress = "test@test.local" }),
            transport ?? new NoOpSmtpTransport()),
        NullLogger<EmailService>.Instance);

    /// <summary>
    /// A SlackService that, by default, has every category routed off (the <see cref="FakeSlackSettingsResolver"/>
    /// default has no token), so existing tests that exercise notification triggers never touch Slack.
    /// Pass a resolver/transport to test the Slack-enabled path.
    /// </summary>
    protected static SlackService TestSlack(ISlackTransport? transport = null, ISlackSettingsResolver? resolver = null) => new(
        resolver ?? new FakeSlackSettingsResolver(),
        transport ?? new NoOpSlackTransport(),
        TestConfig(),
        NullLogger<SlackService>.Instance);

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

/// <summary>Returns fixed SMTP options — lets tests build an EmailDispatcher without a DB-backed resolver.</summary>
internal sealed class FixedEmailSettingsResolver(SmtpOptions options) : IEmailSettingsResolver
{
    public Task<SmtpOptions> ResolveAsync() => Task.FromResult(options);
}

/// <summary>A dispatcher that "succeeds" without doing anything — the default for
/// <see cref="DbTestBase.OutboxProcessor"/> when a test doesn't care how the send turns out.</summary>
internal sealed class FixedEmailDispatcher : IEmailDispatcher
{
    public Task<string?> SendAsync(EmailSendRequest request, CancellationToken ct = default) =>
        Task.FromResult<string?>(null);
}

/// <summary>
/// A settings resolver tests can configure directly, without a DB-backed row. With no token given,
/// every category resolves disabled (matching "Slack not configured" — the default for a test that
/// isn't specifically exercising Slack).
/// </summary>
internal sealed class FakeSlackSettingsResolver(string? token = null, params string[] enabledCategories) : ISlackSettingsResolver
{
    private readonly HashSet<string> _enabled = [.. enabledCategories];

    public Task<string?> ResolveTokenAsync() => Task.FromResult(token);

    public Task<bool> IsCategoryEnabledAsync(string category) =>
        Task.FromResult(token is not null && _enabled.Contains(category));
}

/// <summary>A transport that should never be called — the default FakeSlackSettingsResolver disables
/// every category, so this only fires if a test wires Slack on without also supplying a real fake.</summary>
internal sealed class NoOpSlackTransport : ISlackTransport
{
    public Task<System.Text.Json.JsonElement> CallAsync(
        string token, string method, IReadOnlyDictionary<string, string> form, CancellationToken ct = default) =>
        throw new SlackApiException("not_configured", isTransient: false);
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
