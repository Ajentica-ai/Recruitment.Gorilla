# E2E suite references removed Bootstrap classes, a hardcoded screenshot path and a missing fixture directory
- Source: issue #83 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/83
- Type: bug
## Request
Parts of the suite reference things that no longer exist, so they fail for reasons
unrelated to what they test: stale react-bootstrap selectors, screenshots written to an
absolute `C:/Users/user/.gemini/...` path, and a missing `e2e/test-cvs` directory.
Expected: `npx playwright test` runs on a fresh clone with only `e2e/.env.e2e` filled
in, and every assertion targets a selector that exists.

## Decisions
- Whole suite in scope, not just the three named problems: every spec passes or
  self-skips with a reason. 10 of 22 cases fail today.
- CV fixtures generated into the gitignored `e2e/test-cvs/`, not committed. Parsing
  assertions relaxed only where synthetic text cannot satisfy them.
- Empty-database specs self-skip naming the missing data rather than failing.

## Survey (the issue undercounts)
- Hardcoded path: 7 specs, 19 places, not 2. Missing CVs: 2 specs, not 1, and
  `e2e/test-cvs/` is already gitignored as "generated test CVs".
- Unmentioned: empty-database failures (analytics, e2e-all-tab, responsive-card-header)
  and `compose.spec.ts`, which needs Docker on :8090.

## Out of scope
- Making `compose.spec.ts` actually exercise Docker. It only learns to skip.

## Follow-ups
- `CVParserService` truncates an education institution to one word ("University" from
  the full name). Found while checking the fixtures parse; adjacent to #57.
- The upload specs create drafts and candidates every run and never clean up.
