<!-- phase: DONE | branch: fix/RG-52/Recruiter-header-alignment | tasks: 3/3
     base: 6f46c71 | updated: 2026-10-12
     next: commit + PR on request -->
# Plan: left-align the first column header in the Analytics tables
## Tasks
- [x] Add a test guarding both first-column headers (left-aligned class); confirm it fails first
- [x] AnalyticsPage.tsx: first <th> of the Recruiter and Sourcing tables -> text-left pl-3
- [x] tsc, full npm test, lint; measure header-vs-avatar left edge in Edge on /analytics
## Tests
- Trivial-to-standard: small class assertion + full suite; real alignment checked in the browser (JSDOM cannot measure layout)
## Files
- client/src/pages/AnalyticsPage.tsx, client/src/pages/AnalyticsPage.test.tsx
