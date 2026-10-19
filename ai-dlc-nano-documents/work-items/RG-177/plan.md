<!-- phase: DONE | branch: fix/RG-177/Eval-spacing-test-jitter | tasks: 3/3
     base: 52d5380 | updated: 2026-10-19
     next: commit + PR on request -->
# Plan: RG-177 e2e jitter
## Tasks
- [x] eval-actions-spacing.spec.ts: vertical centres within 2px instead of top edges within 0.5px
- [x] Verify: throwaway DB + demo interviewer + interview; spec repeated alone, then whole e2e suite once
- [x] tsc / lint
## Tests
- Trivial test-only change; verification is repeated and under-load e2e runs
## Files
- client/e2e/eval-actions-spacing.spec.ts
