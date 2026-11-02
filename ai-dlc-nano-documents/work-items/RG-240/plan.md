<!-- phase: DONE | branch: fix/RG-240/Edu-experience-spec-timing | tasks: 1/1
     base: 53e54bc | updated: 2026-11-02
     next: user decides push + PR -->
# Plan: fix flaky timing in education/experience spec
## Tasks
- [x] In `education-experience-profiles.spec.ts` around line 148: start `page.waitForResponse`
      for `/api/candidates/${candidateId}` (status 200, timeout 15 000) before `page.goto()`;
      await the promise after goto; reduce `waitForSelector('.profile-card')` timeout to 5 000.
## Tests
- Standard tier: tsc + oxlint clean. The spec itself is the regression; no new test needed.
## Files
- client/e2e/education-experience-profiles.spec.ts
