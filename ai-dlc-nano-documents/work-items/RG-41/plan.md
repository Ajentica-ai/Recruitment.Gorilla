<!-- phase: DONE | branch: fix/RG-41/User-table-header-alignment | tasks: 3/3
     base: cff0a28 | updated: 2026-10-14
     next: commit + PR on request -->
# Plan: RG-41 Users table header alignment
## Tasks
- [x] Test: Users table headers Name/Email/Roles/Status/Last login are left-aligned; fails first
- [x] UsersPage.tsx: text-left on those <th> (same approach as RG-52)
- [x] tsc, full npm test (browser measurement not done)
## Tests
- Trivial-to-standard: class assertion; real alignment measured in browser (JSDOM has no layout)
## Files
- client/src/pages/UsersPage.tsx, UsersPage.test.tsx
