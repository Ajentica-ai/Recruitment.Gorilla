<!-- phase: DONE | branch: fix/RG-194/Offer-url-candidate-check | tasks: 5/5
     base: e0d057e | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-194 check the URL's candidate id before any offer write (bug, HIGH: auth scope + writes)
## Tasks
- [x] Repro tests (HTTP): offer of candidate 7 via /candidates/5/... for update, submit, extend, decision, pdf: 404 and nothing written (offer, status rows, audit); extend twice = 409
- [x] OfferService: required candidateId param on Update/Submit/Extend/RecordDecision/GeneratePdf, checked right after load (null = 404) before any write
- [x] OffersController: pass candidateId, drop the post-hoc compares; update existing service tests to the new signatures
- [x] ai-docs/auth.md note; full dotnet + client suites; security review
## Tests
- High blast radius (scope + writes): HTTP integration, committed data, assert no change after a mismatched id.
## Files
- Services/OfferService.cs, Controllers/OffersController.cs, OfferRulesTests/OfferServiceTests/OfferStateMachineTests, ai-docs/auth.md
