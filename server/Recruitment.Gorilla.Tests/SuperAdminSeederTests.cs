using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.Models;
using Recruitment.Gorilla.Tests.Infrastructure;

namespace Recruitment.Gorilla.Tests;

/// <summary>
/// #265: the configured Auth:PasswordHash only seeds the first Super Admin. Restarting the API must not put
/// it back after the admin changed their password; a reset needs the explicit Auth:ResetSeedAdminPassword opt-in.
/// </summary>
public class SuperAdminSeederTests(MySqlDatabaseFixture fixture) : DbTestBase(fixture)
{
    private readonly string _email = $"seed-{Guid.NewGuid():N}@e2e.local";

    private IConfiguration Config(string? hash, bool? reset = null)
    {
        var values = new Dictionary<string, string?> { ["Auth:SeedAdminEmail"] = _email, ["Auth:PasswordHash"] = hash };
        if (reset is not null) values["Auth:ResetSeedAdminPassword"] = reset.Value ? "true" : "false";
        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private Task Seed(IConfiguration config, ILogger? logger = null) =>
        SuperAdminSeeder.SeedAsync(Db, config, logger ?? NullLogger.Instance);

    private async Task<User> Admin()
    {
        Db.ChangeTracker.Clear();
        return await Db.Users.Include(u => u.Roles).SingleAsync(u => u.Email == _email);
    }

    [Fact]
    public async Task Seeds_the_first_super_admin_from_the_configured_hash()
    {
        await Seed(Config("original-hash"));

        var admin = await Admin();
        Assert.Equal("original-hash", admin.PasswordHash);
        Assert.False(admin.MustChangePassword);
        Assert.True(admin.IsActive);
        Assert.Contains(admin.Roles, r => r.Role == Roles.SuperAdmin);
    }

    [Fact]
    public async Task Seeds_nothing_when_no_hash_is_configured()
    {
        await Seed(Config(null));

        Assert.False(await Db.Users.AnyAsync(u => u.Email == _email));
    }

    [Fact]
    public async Task A_restart_keeps_the_password_the_admin_changed_to()
    {
        await Seed(Config("original-hash"));
        var admin = await Admin();
        admin.PasswordHash = "changed-by-the-admin";
        await Db.SaveChangesAsync();

        await Seed(Config("original-hash")); // the next startup, same configuration

        Assert.Equal("changed-by-the-admin", (await Admin()).PasswordHash);
    }

    [Fact]
    public async Task A_restart_with_a_rotated_configured_hash_still_keeps_the_database_password()
    {
        await Seed(Config("original-hash"));

        await Seed(Config("a-different-configured-hash"));

        Assert.Equal("original-hash", (await Admin()).PasswordHash);
    }

    [Fact]
    public async Task The_reset_flag_off_or_false_changes_nothing()
    {
        await Seed(Config("original-hash"));

        await Seed(Config("new-hash", reset: false));

        Assert.Equal("original-hash", (await Admin()).PasswordHash);
    }

    [Fact]
    public async Task The_reset_flag_applies_the_configured_hash_forces_a_change_and_ends_sessions()
    {
        await Seed(Config("original-hash"));
        var admin = await Admin();
        admin.PasswordHash = "changed-by-the-admin";
        Db.RefreshTokens.Add(new RefreshToken
        {
            TokenHash = $"t-{Guid.NewGuid():N}", Username = admin.Id.ToString(), ExpiresAt = DateTime.UtcNow.AddDays(7),
        });
        var others = new RefreshToken
        {
            TokenHash = $"o-{Guid.NewGuid():N}", Username = "-1", ExpiresAt = DateTime.UtcNow.AddDays(7),
        };
        Db.RefreshTokens.Add(others);
        await Db.SaveChangesAsync();
        var log = new CapturingLogger();

        await Seed(Config("break-glass-hash", reset: true), log);

        var after = await Admin();
        Assert.Equal("break-glass-hash", after.PasswordHash);
        Assert.True(after.MustChangePassword);
        var mine = await Db.RefreshTokens.Where(t => t.Username == after.Id.ToString()).ToListAsync();
        Assert.NotEmpty(mine);
        Assert.All(mine, t => Assert.NotNull(t.RevokedAt));
        Assert.Null((await Db.RefreshTokens.SingleAsync(t => t.Id == others.Id)).RevokedAt);
        Assert.Contains(log.Warnings, w => w.Contains("ResetSeedAdminPassword"));
    }

    [Fact]
    public async Task The_reset_flag_does_nothing_when_the_hash_already_matches()
    {
        await Seed(Config("original-hash"));
        var admin = await Admin();
        Db.RefreshTokens.Add(new RefreshToken
        {
            TokenHash = $"t-{Guid.NewGuid():N}", Username = admin.Id.ToString(), ExpiresAt = DateTime.UtcNow.AddDays(7),
        });
        await Db.SaveChangesAsync();

        await Seed(Config("original-hash", reset: true));

        var after = await Admin();
        Assert.False(after.MustChangePassword);
        Assert.All(await Db.RefreshTokens.Where(t => t.Username == after.Id.ToString()).ToListAsync(),
            t => Assert.Null(t.RevokedAt));
    }

    [Fact]
    public async Task The_reset_flag_without_a_configured_hash_changes_nothing()
    {
        await Seed(Config("original-hash"));

        await Seed(Config(null, reset: true));

        Assert.Equal("original-hash", (await Admin()).PasswordHash);
    }

    private sealed class CapturingLogger : ILogger
    {
        public List<string> Warnings { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Warning) Warnings.Add(formatter(state, exception));
        }
    }
}
