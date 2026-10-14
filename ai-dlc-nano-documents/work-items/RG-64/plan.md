<!-- phase: DONE | branch: fix/RG-64/Page-size-dropdown-in-viewport | tasks: 5/5
     base: e65f126 | updated: 2026-10-14
     next: commit + PR on request -->
# Plan: RG-64 page-size dropdown stays inside the window
## Tasks
- [x] Test: Pagination per-page select shows the value, picking 25 calls onPageSizeChange(25)
- [x] Pagination.tsx: NativeSelect -> Radix Select (same size h-8 w-20, same aria-label)
- [x] tsc + full npm test
- [x] Playwright: small window, pager near bottom, open list, assert it is inside the viewport
- [x] ai-docs/frontend.md note
## Tests
- Standard: Vitest for behaviour; Playwright geometry check for the real constraint
## Files
- client/src/components/common/Pagination.tsx, Pagination.test.tsx (new), ai-docs/frontend.md
