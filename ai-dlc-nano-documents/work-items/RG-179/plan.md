<!-- phase: DONE | branch: fix/RG-179/E2E-cleanup-fixtures | tasks: 4/4
     base: 024c6e0 | updated: 2026-10-19
     next: commit + PR on request -->
# Plan: RG-179 e2e cleanup
## Tasks
- [x] e2e/cleanup.ts: markData() / cleanupSince()
- [x] Wire into bulk-upload-10-cvs, json-import, education-experience-profiles (afterEach)
- [x] Verify on a throwaway DB: counts (drafts, candidates, Uploads files) equal before/after; baseline shows growth
- [x] tsc / lint; docs note; backlog line
## Tests
- Test infrastructure: verification is before/after counts, repeated, plus the full suite
## Files
- client/e2e/cleanup.ts (new), three specs, docs
