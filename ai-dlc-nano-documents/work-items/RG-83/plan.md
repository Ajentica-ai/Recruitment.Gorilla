<!-- phase: DONE | branch: fix/RG-83/E2e-suite-references | tasks: 7/7
     base: eff9d56 | updated: 2026-10-02
     next: summarise; nothing committed yet, commit and push need approval -->
# Plan: Make the E2E suite runnable on a fresh clone

Rigor tier: **standard**. The suite *is* the test, so verification is the suite itself:
22 cases, every one passing or skipping with a stated reason, from 10 failing today.

## Tasks
- [x] `e2e/helpers.ts`: a `shotDir()` resolving `E2E_SHOT_DIR` or defaulting under the
      already-gitignored `client/test-results/`, a `signIn()`, and a `requireData()`
      guard that skips with a message naming what is missing.
- [x] Replace the hardcoded `C:/Users/user/.gemini/...` path in all **7** specs
      (19 occurrences): analytics-and-upload, bulk-upload-10-cvs, e2e-all-tab,
      education-experience-profiles, kanban-pipeline, offer-management,
      screenshot-interview.
- [x] `e2e/make-test-cvs.mjs` plus an npm script: writes minimal valid PDFs carrying
      realistic CV text into `e2e/test-cvs/` (gitignored, and the gitignore comment
      already calls them "generated test CVs"). Wire bulk-upload and
      education-experience to generate on demand and skip if generation is impossible.
- [x] Fix the stale selectors in `kanban-pipeline.spec.ts`. Note the Advance Status
      surface is a **drawer** since #85, so it is `[data-slot="sheet-content"]` and a
      heading, not `.modal-title` / `.modal-header .btn-close`.
- [x] Self-skip on an empty database: analytics-and-upload (needs analytics data),
      e2e-all-tab (needs pending drafts), responsive-card-header (needs dashboard
      cards and an interview the `E2E_EMAIL` recruiter can open). Clears the backlog
      line from RG-84.
- [x] `compose.spec.ts`: skip unless `COMPOSE_BASE_URL` answers. It tests the Docker
      stack and cannot pass against the Vite dev server.
- [x] Verify + docs: full `npx playwright test` with 0 failures; `tsc -b`, `npm test`,
      `npm run lint`; then `ai-docs/dev-setup.md`, `.env.e2e.example`, file count 439.

## Tests
- The suite itself. Target 0 failed, every skip stating why. Vitest 119 untouched.

## Files
- `client/e2e/helpers.ts`, `client/e2e/make-test-cvs.mjs` (both new), `client/package.json`
- All 7 specs above, plus `compose.spec.ts` and `responsive-card-header.spec.ts`
- `client/e2e/.env.e2e.example`, `ai-docs/dev-setup.md`, `ai-dlc-nano-documents/backlog.md`
