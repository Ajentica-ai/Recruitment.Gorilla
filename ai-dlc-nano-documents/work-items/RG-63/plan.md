<!-- phase: DONE | branch: fix/RG-63/Candidates-table-header-alignment | tasks: 3/3
     base: 210a147 | updated: 2026-10-14
     next: commit + PR on request -->
# Plan: RG-63 Candidates table header alignment
## Tasks
- [x] Test: Candidates table headers are left-aligned; fails first
- [x] CandidatesPage.tsx: text-left on the five data <th> (same approach as RG-41)
- [x] tsc, full npm test; measure header vs cell left edge in the browser
## Tests
- Standard-light: class assertion + real alignment measured with Playwright (JSDOM has no layout)
## Files
- client/src/pages/CandidatesPage.tsx, CandidatesPage.test.tsx (new or existing)
