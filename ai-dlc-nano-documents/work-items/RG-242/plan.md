<!-- phase: DONE | branch: fix/RG-242/No-retry-on-404-candidate | tasks: 2/2
     base: 5d0f36b | updated: 2026-11-02
     next: user decides push + PR -->
# Plan: skip 404 retry on candidate detail query
## Tasks
- [x] `CandidateDetailPage.tsx`: import `isAxiosError` from `axios`; add `retry` option to the
      candidate useQuery that returns false for 404, else failureCount < 3.
- [x] New `CandidateDetailPage.test.tsx`: mock `getCandidate` to reject with a 404 AxiosError;
      render with a QueryClient whose global retry is 3; assert the error heading appears within
      2 s and `getCandidate` was called exactly once (no retries).
## Tests
- Standard tier: new test passes in 57 ms; full suite 391/391 green.
## Files
- client/src/pages/CandidateDetailPage.tsx
- client/src/pages/CandidateDetailPage.test.tsx  (new)
