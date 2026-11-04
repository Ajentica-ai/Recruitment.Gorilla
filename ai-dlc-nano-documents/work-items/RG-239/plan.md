<!-- phase: DONE | branch: fix/RG-239/Kanban-spec-hardcoded-env | tasks: 1/1
     base: c7980b2 | updated: 2026-10-29
     next: user decides push + PR -->
# Plan: fix kanban spec hardcoded env
## Tasks
- [x] In `kanban-pipeline.spec.ts`: import `signIn` and `ADMIN` from `./helpers`; add skip guard;
      replace login block with `await signIn(page, ADMIN)`; replace two hardcoded URLs with
      relative paths (`/candidates`); drop conditional URL check.
## Tests
- Standard tier: tsc clean, oxlint clean. The spec itself is the regression test.
## Files
- client/e2e/kanban-pipeline.spec.ts
