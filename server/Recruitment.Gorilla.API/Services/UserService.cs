using Microsoft.EntityFrameworkCore;
using Recruitment.Gorilla.API.Auth;
using Recruitment.Gorilla.API.Data;
using Recruitment.Gorilla.API.DTOs;
using Recruitment.Gorilla.API.Models;

namespace Recruitment.Gorilla.API.Services;

public class UserService(AppDbContext db, EmailService emailService)
{
    public async Task<List<UserListDto>> GetAllAsync() =>
        await db.Users
            .Include(u => u.Roles)
            .OrderBy(u => u.Name)
            .Select(u => new UserListDto(
                u.Id, u.Name, u.Email,
                u.Roles.Select(r => r.Role).ToArray(),
                u.IsActive, u.MustChangePassword, u.CreatedAt, u.LastLoginAt))
            .ToListAsync();

    /// <summary>Result of a mutating operation: an error message, or null on success.</summary>
    public record MutationResult(UserListDto? User, string? Error)
    {
        public static MutationResult Ok(UserListDto user) => new(user, null);
        public static MutationResult Fail(string error) => new(null, error);
    }

    public async Task<MutationResult> CreateAsync(CreateUserDto dto, int createdByUserId)
    {
        var error = ValidateRoles(dto.Roles)
            ?? ValidateEmail(dto.Email)
            ?? PersonNameValidator.Validate(dto.Name, "Name")
            ?? (string.IsNullOrWhiteSpace(dto.TemporaryPassword) ? "A temporary password is required." : null);
        if (error is not null) return MutationResult.Fail(error);

        var email = dto.Email.Trim();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return MutationResult.Fail("A user with that email already exists.");

        var user = new User
        {
            Name = dto.Name.Trim(),
            Email = email,
            PasswordHash = PasswordHasher.Hash(dto.TemporaryPassword),
            MustChangePassword = true,
            IsActive = true,
            CreatedByUserId = createdByUserId,
            Roles = DistinctRoles(dto.Roles).Select(r => new UserRole { Role = r }).ToList(),
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        var (subject, html) = EmailTemplates.AccountCreated(user.Name);
        await emailService.SendAsync(user.Email, user.Name, subject, html);

        return MutationResult.Ok(ToDto(user));
    }

    public async Task<MutationResult> UpdateAsync(int id, UpdateUserDto dto)
    {
        var error = ValidateRoles(dto.Roles)
            ?? PersonNameValidator.Validate(dto.Name, "Name");
        if (error is not null) return MutationResult.Fail(error);

        var user = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return MutationResult.Fail("User not found.");

        var newRoles = DistinctRoles(dto.Roles);

        // Protect the last active Super Admin from losing the role or being deactivated.
        var wasActiveSuperAdmin = user.IsActive && user.Roles.Any(r => r.Role == Roles.SuperAdmin);
        var staysActiveSuperAdmin = dto.IsActive && newRoles.Contains(Roles.SuperAdmin);
        if (wasActiveSuperAdmin && !staysActiveSuperAdmin && await IsLastActiveSuperAdminAsync(id))
            return MutationResult.Fail("Cannot remove the last active Super Admin.");

        user.Name = dto.Name.Trim();
        user.IsActive = dto.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        // Replace role assignments with the new set.
        user.Roles.Clear();
        foreach (var role in newRoles)
            user.Roles.Add(new UserRole { Role = role });

        await db.SaveChangesAsync();
        return MutationResult.Ok(ToDto(user));
    }

    public async Task<MutationResult> ResetPasswordAsync(int id, string temporaryPassword)
    {
        if (string.IsNullOrWhiteSpace(temporaryPassword))
            return MutationResult.Fail("A temporary password is required.");

        var user = await db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return MutationResult.Fail("User not found.");

        user.PasswordHash = PasswordHasher.Hash(temporaryPassword);
        user.MustChangePassword = true;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var (subject, html) = EmailTemplates.PasswordReset(user.Name);
        await emailService.SendAsync(user.Email, user.Name, subject, html);

        return MutationResult.Ok(ToDto(user));
    }

    private async Task<bool> IsLastActiveSuperAdminAsync(int excludingUserId) =>
        !await db.Users.AnyAsync(u =>
            u.Id != excludingUserId &&
            u.IsActive &&
            u.Roles.Any(r => r.Role == Roles.SuperAdmin));

    private static string? ValidateRoles(string[] roles)
    {
        var distinct = DistinctRoles(roles);
        if (distinct.Count == 0) return "At least one role is required.";
        if (distinct.Any(r => !Roles.All.Contains(r))) return "One or more roles are invalid.";
        return null;
    }

    private static string? ValidateEmail(string email) =>
        string.IsNullOrWhiteSpace(email) || !email.Contains('@')
            ? "A valid email address is required."
            : null;

    private static List<string> DistinctRoles(string[] roles) =>
        (roles ?? []).Where(r => !string.IsNullOrWhiteSpace(r)).Distinct().ToList();

    private static UserListDto ToDto(User u) => new(
        u.Id, u.Name, u.Email,
        u.Roles.Select(r => r.Role).ToArray(),
        u.IsActive, u.MustChangePassword, u.CreatedAt, u.LastLoginAt);
}
