<!-- phase: DONE | branch: fix/RG-264/Enforce-forced-password-change | tasks: 6/6
     base: 82f9f86 | updated: 2026-11-23
     next: none -->
# Plan: Enforce forced password change on the API (#264)
## Tasks
- [x] Failing integration tests first (ForcedPasswordChangeTests): must-change user 403 on candidates, dashboard kpis, my interviews, an Admin-only endpoint and the CV upload hub; change-password 204; then the same calls 200
- [x] Program.cs: one policy builder (authenticated + PasswordChangedRequirement) used for BOTH FallbackPolicy and DefaultPolicy
- [x] Keep login, refresh, logout anonymous and unchanged; test a must-change user can still refresh and log out
- [x] Client: while mustChangePassword, disable the shell polling queries (NotificationBell, SidebarNav drafts) so the forced screen makes no calls that now 403
- [x] ai-docs/auth.md corrected (DefaultPolicy as well as FallbackPolicy); Vitest for the client change
- [x] Verify in browser on a scratch stack: temp-password login, change password, then dashboard loads; no console 403 noise
## Tests
- High blast radius (auth): xUnit through the real HTTP pipeline for every case above, plus full dotnet + vitest, tsc, oxlint.
## Files
- Program.cs, Authorization/PasswordChangedRequirement.cs (comment), ApiFixture.cs, new ForcedPasswordChangeTests.cs, NotificationBell.tsx, SidebarNav.tsx (+tests), ai-docs/auth.md
