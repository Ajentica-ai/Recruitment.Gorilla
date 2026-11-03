<!-- phase: DONE | branch: fix/RG-246/Sanitize-failed-login-email | tasks: 2/2
     base: fdeeec2 | updated: 2026-11-03
     next: done -->
# Plan: sanitize failed-login email before logging
## Tasks
- [x] Add SanitizeEmail(string email) to AuthController: strip \r \n \t, truncate to 200 chars
- [x] Replace 4 raw dto.Email usages in the two failed-login paths with SanitizeEmail(dto.Email)
## Tests
- Standard: one integration test in AuthLoginTests.cs — POST /api/auth/login with \r\n and
  5000-char email; assert audit Summary is single-line and under 210 chars
## Files
- server/Recruitment.Gorilla.API/Controllers/AuthController.cs
- server/Recruitment.Gorilla.Tests/AuthLoginTests.cs
