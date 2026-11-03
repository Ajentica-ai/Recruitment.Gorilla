<!-- phase: CONSTRUCT | branch: fix/RG-245/Revoke-tokens-on-deactivation | tasks: 5/5
     base: 210a147 | updated: 2026-11-03
     next: commit -->
# Plan: revoke tokens on user deactivation
## Tasks
- [x] UserService.UpdateAsync: capture wasActive, after SaveChangesAsync run ExecuteUpdateAsync
      to set RevokedAt on all active RefreshTokens where Username == userId && RevokedAt == null
      when wasActive && !dto.IsActive
- [x] Program.cs: add OnTokenValidated to JwtBearerEvents — query user.IsActive by sub claim,
      call context.Fail("User is inactive.") if not active; resolve AppDbContext from RequestServices
- [x] ApiFixture.cs: add NewActiveUserAsync(string role = Roles.Recruiter) returning (Email, Id)
- [x] AuthServiceTests.cs: add unit test verifying that UpdateAsync deactivation immediately
      revokes all refresh tokens in the DB (not just at next refresh attempt)
- [x] UserDeactivationTests.cs: two integration tests over the real HTTP pipeline:
      (a) access token returns 401 after deactivation
      (b) POST /api/auth/refresh returns 401 after deactivation (cookie from login still present)
## Tests
- High blast radius (auth/security): service-level + integration (HTTP pipeline).
- No E2E (Playwright) test needed — the integration tests cover the full backend path.
## Files
- server/Recruitment.Gorilla.API/Services/UserService.cs
- server/Recruitment.Gorilla.API/Program.cs
- server/Recruitment.Gorilla.Tests/Infrastructure/ApiFixture.cs
- server/Recruitment.Gorilla.Tests/AuthServiceTests.cs
- server/Recruitment.Gorilla.Tests/UserDeactivationTests.cs (new)
