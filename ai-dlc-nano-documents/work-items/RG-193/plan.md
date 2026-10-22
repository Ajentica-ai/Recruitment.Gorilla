<!-- phase: DONE | branch: fix/RG-193/Offer-status-rules-and-lock | tasks: 7/7
     base: 7cc896b | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-193 offer actions obey status rules and the End Date lock (bug, HIGH: status/pipeline integrity, concurrency)
## Tasks
- [x] Repro tests first (service + HTTP): Rejected/Hired/Uploaded create refused; ended opening refused on all offer actions; 2nd live offer 409; double extend = 1 status row
- [x] OfferService: shared precondition (lock via GetRoleLockErrorAsync, candidate status allow-list) -> 400 via a new OfferValidationException
- [x] CreateOffer: one live offer per candidate -> OfferStateException (409)
- [x] Extend/RecordDecision/Create: validate the status move before writing; no half-done state
- [x] Double click: extend guarded by Status concurrency token (RG-192) so the loser is 409, one timeline row
- [x] OffersController: map validation to 400; client OfferCard shows server reason, hides Create when blocked
- [x] Docs (auth.md, data-model.md, user guide), full dotnet + client suites, isolated-stack check, security review
## Tests
- High blast radius: failure paths + races; backend xUnit (DbTestBase + ApiFixture HTTP), Vitest for OfferCard.
## Files
- Services/OfferService.cs, Controllers/OffersController.cs, new OfferValidationException, OfferCard.tsx(+test), OfferStateMachineTests/new tests, ai-docs, UserGuide chapter-2
## Dependency
- Task 5 needs the Status concurrency token from RG-192 (PR #219, unmerged); same file as #219.
