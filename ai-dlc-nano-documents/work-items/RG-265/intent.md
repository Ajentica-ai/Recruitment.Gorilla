# Restarting the API must not revert the Super Admin's password (#265)
- Source: issue #265 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/265 (OPEN, assigned rayhan-ajentica)
- Type: bug (security, backend, priority high)
## Request
- Program.cs startup seeding overwrites the Super Admin's PasswordHash whenever it differs from Auth:PasswordHash, so a restart or deploy restores the old configured password.
- Remove that branch. Break-glass reset only behind an explicit opt-in (Auth:ResetSeedAdminPassword=true): warns, sets MustChangePassword, documented in ai-docs/dev-setup.md.
- Test: seed, change the hash in the DB, run seeding again, hash unchanged.
## Decisions
- Plan approved; branch off origin/develop; revoke refresh tokens on break-glass reset; extract SuperAdminSeeder -> user: go with recommendation
## Out of scope
- Other seed settings (SeedAdminEmail, SeedAdminName).
## Follow-ups
- .github/scripts/recruitment-deploy.sh admin_state guard (refuses deploy when stored admin hash differs) is now obsolete; remove in a separate change
