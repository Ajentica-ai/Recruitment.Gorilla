<!-- phase: DONE | branch: fix/RG-265/Keep-admin-password-on-restart | tasks: 6/6
     base: 82f9f86 | updated: 2026-11-23
     next: PR (Closes #265) -->
# Plan: keep the Super Admin password on restart (#265)
## Tasks
- [x] Extract the startup seeding block of Program.cs into SuperAdminSeeder.SeedAsync(db, config, logger), behaviour unchanged
- [x] Failing test first: seed, change the hash in the DB, seed again, hash unchanged
- [x] Remove the overwrite branch; add opt-in Auth:ResetSeedAdminPassword (warning log, hash from config, MustChangePassword=true, refresh tokens revoked)
- [x] More tests: first seed, no hash configured, flag resets, flag off keeps, flag with unchanged hash is a no-op
- [x] Docs: ai-docs/auth.md seeding section, ai-docs/dev-setup.md break-glass reset
- [x] dotnet test full suite green
## Tests
- High blast radius (auth). DbTestBase tests on the seeder, including the failure and reset paths.
## Files
- server/Recruitment.Gorilla.API/Program.cs, Data/SuperAdminSeeder.cs (new)
- server/Recruitment.Gorilla.Tests/SuperAdminSeederTests.cs (new)
- ai-docs/auth.md, ai-docs/dev-setup.md
