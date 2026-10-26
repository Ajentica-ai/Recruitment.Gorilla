<!-- phase: DONE | branch: fix/RG-178/Card-header-spec-race | tasks: 4/4
     base: 0f798b0 | updated: 2026-10-19
     next: commit + PR on request -->
# Plan: RG-178 card-header spec race
## Tasks
- [x] Chip test: sign in wide, then 390px; waitFor .interview-chip before requireData
- [x] Sibling test: wait for a dashboard card header before requireData
- [x] Verify on throwaway DB with an interview: both tests RUN and pass (repeat + full suite); mutation check that a squashed icon fails
- [x] tsc / lint
## Tests
- Test-only; verification is repeated runs plus a deliberate-break check
## Files
- client/e2e/responsive-card-header.spec.ts
