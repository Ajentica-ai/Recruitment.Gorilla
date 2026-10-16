<!-- phase: DONE | branch: fix/RG-66/Row-menu-beside-row | tasks: 5/5
     base: e65f126 | updated: 2026-10-14
     next: commit + PR on request -->
# Plan: RG-66 row menu opens beside its row
## Tasks
- [x] Test: RowActions menu content opens with side=left; fails first
- [x] RowActions.tsx: side="left", update the #65 comment
- [x] tsc + full npm test
- [x] Playwright: Candidates table 1912w, card layout ~750w, Users table: menu never overlaps another row
- [x] docs only if menu direction is mentioned
## Tests
- Standard: Vitest for the placement prop; Playwright geometry for the real constraint
## Files
- client/src/components/common/RowActions.tsx, RowActions.test.tsx (new)
