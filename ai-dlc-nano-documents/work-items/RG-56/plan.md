<!-- phase: DONE | branch: fix/RG-56/Relevant-experience-default | tasks: 5/5
     base: b4b25e0 | updated: 2026-10-13
     next: none -->
# Plan: RG-56 Relevant Experience default
## Tasks
- [x] Failing test: ~10 years of dated roles maps to "8+ Years"
- [x] CVParserService: compute total years from experience date ranges (merge overlaps), map to presets
- [x] Pass the value into the draft at creation (CandidateDraftService / upload path)
- [x] Client: drop '3-5 Years' fallback (empty so reviewer must choose)
- [x] dotnet test + npm test; verify in app; update ai-docs
## Tests
- Standard: xUnit parser cases (10y, 2y, no dates, overlap); Vitest for empty fallback.
## Files
- CVParserService.cs, CandidateDraftService.cs, CUploadController (if needed), DraftReviewWorkspace.tsx, tests, ai-docs
