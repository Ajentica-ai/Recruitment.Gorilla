<!-- phase: DONE | branch: fix/RG-49/Logout-keeps-previous-page | tasks: 4/4
     base: 51946a6 | updated: 2026-10-08
     next: commit + PR on user request -->
# Plan: explicit logout must not leave a return-to path
## Tasks
- [x] Failing test: after explicit logout, the redirect to /login carries no `from`
- [x] AuthContext: track explicit logout; ProtectedLayout (App.tsx) omits `from` when set, reset on login
- [x] Keep `from` for session expiry (existing LoginPage tests stay green)
- [x] Browser re-check (Recruiter logout -> Interviewer/Admin login lands on /)
## Tests
- Standard: Vitest (App/AuthContext), full npm test + tsc + lint, Playwright repro
## Files
- client/src/auth/AuthContext.tsx, client/src/App.tsx (+ tests)
