<!-- phase: DONE | branch: fix/RG-99/Interviewer-landing-page | tasks: 5/5
     base: c872bea | updated: 2026-10-02
     next: none; awaiting commit/PR on request -->
# Plan: Send users without a page's role to the Dashboard
## Tasks
- [x] Repro tests (fail first): RequireRole with an Interviewer at /candidates renders the Dashboard route; LoginPage with no saved `from` lands on /; ChangePasswordPage success lands on /
- [x] RequireRole: redirect to `/`, fix its doc comment
- [x] LoginPage default target `/`; ChangePasswordPage navigates to `/` after a successful change
- [x] Docs: ai-docs/frontend.md (+ auth.md if it names the fallback) match the new landing
- [x] Verify: npx tsc -b, npm test, npm run lint; live Interviewer sign-in in the browser if the API is up
## Tests
- Standard. New Vitest tests mocking useAuth (Interviewer roles) in a MemoryRouter with / and /candidates routes.
## Files
- client/src/components/RequireRole.tsx (+ RequireRole.test.tsx)
- client/src/pages/LoginPage.tsx, ChangePasswordPage.tsx (+ tests)
- ai-docs/frontend.md, ai-docs/auth.md
