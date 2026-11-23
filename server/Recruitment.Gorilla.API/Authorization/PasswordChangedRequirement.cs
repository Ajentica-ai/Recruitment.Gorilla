using Microsoft.AspNetCore.Authorization;

namespace Recruitment.Gorilla.API.Authorization;

/// <summary>
/// Requires that the authenticated user is not in a "must change password" state.
/// Applied through the default policy, the fallback policy and a global MVC filter (see Program.cs, #264), so it
/// guards every endpoint except the allow-listed ones (the change-password endpoint), forcing a first-login user to
/// set a new password before doing anything else.
/// </summary>
public class PasswordChangedRequirement : IAuthorizationRequirement;

public class PasswordChangedHandler(IHttpContextAccessor accessor)
    : AuthorizationHandler<PasswordChangedRequirement>
{
    /// <summary>Endpoints reachable while a password change is still pending.</summary>
    private static readonly string[] AllowedPaths = ["/api/auth/change-password"];

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PasswordChangedRequirement requirement)
    {
        var mustChange = context.User.FindFirst("must_change_password")?.Value == "true";
        var path = accessor.HttpContext?.Request.Path.Value ?? string.Empty;

        if (!mustChange || AllowedPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase)))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
