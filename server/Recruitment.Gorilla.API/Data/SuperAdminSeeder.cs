using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Data;

/// <summary>
/// Startup seeding of the first Super Admin from configuration. Kept out of Program.cs so it can be
/// run directly by tests.
/// </summary>
public static class SuperAdminSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var email = config["Auth:SeedAdminEmail"] ?? "admin@recruitmentgorilla.com";
        var passwordHash = config["Auth:PasswordHash"];
        var adminUser = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Email == email);
        if (adminUser is null)
        {
            if (string.IsNullOrWhiteSpace(passwordHash))
            {
                logger.LogWarning(
                    "No users exist and Auth:PasswordHash is not configured: no Super Admin was seeded.");
            }
            else
            {
                var name = config["Auth:SeedAdminName"] ?? "Super Admin";
                db.Users.Add(new User
                {
                    Name = name,
                    Email = email,
                    PasswordHash = passwordHash,
                    MustChangePassword = false,
                    IsActive = true,
                    Roles = [new UserRole { Role = Roles.SuperAdmin }],
                });
                await db.SaveChangesAsync();
                logger.LogInformation("Seeded initial Super Admin '{Email}'.", email);
            }
        }
        else if (config.GetValue<bool>("Auth:ResetSeedAdminPassword")
                 && !string.IsNullOrWhiteSpace(passwordHash) && adminUser.PasswordHash != passwordHash)
        {
            // Break-glass only (#265). The configured hash seeds the first Super Admin and nothing else: without
            // this explicit opt-in a restart must never put an old configured password back after the admin
            // changed it. The reset forces a new password at the next sign-in and ends the admin's sessions.
            adminUser.PasswordHash = passwordHash;
            adminUser.MustChangePassword = true;
            var userId = adminUser.Id.ToString();
            var now = DateTime.UtcNow;
            foreach (var token in await db.RefreshTokens.Where(t => t.Username == userId && t.RevokedAt == null).ToListAsync())
                token.RevokedAt = now;
            await db.SaveChangesAsync();
            logger.LogWarning(
                "Auth:ResetSeedAdminPassword is on: Super Admin '{Email}' password was reset from configuration, " +
                "a password change is required at next sign-in and its sessions were ended. Remove the setting.", email);
        }
    }
}
