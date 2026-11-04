# E2E education/experience spec: fix flaky timing on profile load
- Source: issue #240 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/240
- Type: bug
## Request
- `education-experience-profiles.spec.ts` flakes in the full suite: `waitForSelector('.profile-card', 15s)`
  times out after `page.goto('/candidates/ID')` because TanStack Query's fetch hasn't resolved yet
- Fix: register `waitForResponse` for `/api/candidates/{id}` before the goto; after it resolves
  the card is already rendered, so the selector check becomes a short finish-line assertion
## Decisions
- Use `page.waitForResponse()` started before `page.goto()` to eliminate the race (canonical Playwright pattern)
- Keep a short selector timeout (5 s) after the response arrives as a sanity check
## Out of scope
- No changes to other specs, helpers, or API code
