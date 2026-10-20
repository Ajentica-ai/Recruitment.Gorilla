<!-- phase: WRAP-UP | branch: fix/RG-192/Offer-state-machine | tasks: 7/7
     base: e9d40c4 | updated: 2026-10-25
     next: user decides the new-version bypass, then push + PR (Closes #192)
# Plan: RG-192 the offer approval binds the offer (bug, HIGH blast radius: compensation + approval workflow)
## Tasks
- [x] Repro first (backend): update on Approved/Extended/Accepted/Declined/PendingApproval succeeds today; extend on PendingApproval and on a rejected Draft succeeds; submit on Approved/Extended/Accepted/Declined/PendingApproval succeeds; extend/decision refusals surface as 500 over HTTP
- [x] OfferService: Update only from Draft; Submit only from Draft; Extend only from Approved or a Draft with no Rejected approval; all refusals as InvalidOperationException with a clear message; nothing written before the check
- [x] OffersController: map InvalidOperationException to 409 on update, submit-approval, extend and decision (review already does); keep 404 for missing or out-of-scope
- [x] Client OfferCard: hide Extend on a rejected Draft with a note ("rejected: edit it and request approval again"), show the server message in every offer action toast (extend, submit, review, update, decision); no other UI change
- [x] Tests: backend integration for EVERY disallowed transition (409 over HTTP and service refusal) incl. edit-after-approve, extend-after-reject, extend-while-pending, resubmit-after-accept, and every allowed path still works (draft edit, draft->submit, submit->approve->extend, draft->extend, extend->decision, reject->edit->resubmit->approve->extend); Vitest: Extend hidden on a rejected Draft, shown on Draft and Approved, server message toast
- [x] Docs: ai-docs/backend.md + auth.md offer state machine, user guide 2.8 sentence about rejected drafts, backlog entry for the write-then-404 controller check
- [x] dotnet test, npx tsc -b, npm test, lint; isolated stack check through the real API (edit-after-approve 409, extend-after-reject 409, normal flow works) + security review (approval workflow); notes
## Tests
- High blast radius (money, approval): failure paths for every transition, plus the full happy path. Kept as regression.
## Files
- Services/OfferService.cs, Controllers/OffersController.cs, tests (OfferServiceTests + new HTTP tests); client components/offers/OfferCard.tsx (+test); ai-docs, UserGuide/chapter-2-recruiter.md
