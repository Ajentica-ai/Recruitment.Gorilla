<!-- phase: DONE | branch: fix/RG-195/Candidate-list-filters | tasks: 5/5
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-195 candidates list honours batch and the hired/offers buckets (bug, standard)
## Tasks
- [x] Repro tests: HTTP `?batch=` narrows (by name and by id); service `bucket=hired` / `offers` return only matching candidates, scope-limited Recruiter too
- [x] CandidatesController.GetAll: `[FromQuery] string? batch`, pass `Batch: batch`
- [x] CandidateBuckets: HiredStatuses/OfferStatuses sets; CandidateService.GetAllAsync cases for Hired and Offers
- [x] CandidatesPage.tsx BUCKET_LABELS: Hired, Offers (+ client test); docs if the list filters are documented
- [x] Full dotnet + client suites, verify via the real API, security review of the diff
## Tests
- Standard: failing tests first, kept as regression tests; HTTP for the controller gap, service tests for buckets.
## Files
- Controllers/CandidatesController.cs, Services/CandidateBuckets.cs, Services/CandidateService.cs, CandidatesPage.tsx(+test), tests, ai-docs if relevant
