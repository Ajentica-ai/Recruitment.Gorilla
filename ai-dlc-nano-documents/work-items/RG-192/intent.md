# Offer approval does not bind the offer: terms editable after approval, rejected or pending offers can be extended
- Source: issue #192 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/192
- Type: bug (workflow guards, server + UI)
## Request
- UpdateOfferAsync has no status check (terms editable on Approved/Extended/Accepted/Declined); ExtendOfferAsync only refuses Extended/Accepted/Declined (so PendingApproval and a rejected Draft can be extended); SubmitForApprovalAsync has no guard (an Accepted offer can go back to PendingApproval).
- Expected: an explicit per-action state machine, 409 otherwise. Update terms: Draft; Submit: Draft; Review: PendingApproval (already enforced); Extend: Approved (and Draft only if approval is optional, never a rejected Draft); Record decision: Extended (already enforced).
- Product decision asked: is approval mandatory before extending? The UI offers Extend on a Draft. If optional, track "was rejected" so a rejected offer cannot be extended without resubmission.
- Tests: integration for each disallowed transition returning 409, incl. edit-after-approve and extend-after-reject; UI hides actions the state machine refuses.
## Decisions
- Approval stays optional (user guide 2.8 documents it, an existing test relies on it): a Draft may be extended directly EXCEPT a rejected Draft, which must be resubmitted and approved first (user: go with recommendation)
- "Was rejected" is derived, no schema change: a Draft with a Rejected approval on record; editing alone does not clear it
- State machine: Update Draft; Submit Draft; Extend Approved or un-rejected Draft; Review PendingApproval and Decision Extended unchanged; every refusal is a 409 with a clear message on all endpoints (extend and decision gave 500)
- Client hides Extend on a rejected Draft with an explanatory note and shows server messages in offer toasts
- The write-then-404 candidateId check in the controller stays out of scope (backlog)
- Branch -> fix/RG-192/Offer-state-machine from origin/develop
## Out of scope
- Offer letter PDF, metrics, the candidate status pipeline.
## Follow-ups
- Security review (no High): fixed here: Offer.Status concurrency token + SaveOfferAsync (races refused), dedicated OfferStateException (only state refusals become 409), out-of-scope 404 pinned by tests, latest rejection shown. Backlog: stale-page approval of edited terms, shared error helper.
- OPEN PRODUCT DECISION: a rejection is per offer row, so after an Admin rejects offer A a Recruiter can create a New Version and extend it directly (approval is optional). Options: candidate-level rule (any rejection for the candidate makes approval mandatory for later offers) or accept it. Not decided yet.
- Seen: Update/Submit/Extend/Decision services act first and the controller compares updated.CandidateId afterwards (write then 404), the same flaw already fixed for Review. Not in scope here.
