# Employee referral missing from the bulk-upload review screen

- Source: issue #156 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/156
- Type: Bug (labels: bug, UI)

## Request
- The draft review workspace has no referral control: its sourcing block ends at Source Detail / Campaign.
- The control exists only after approval, in the candidate profile's Contact & Sourcing Details panel, so a referral known at intake needs a second edit pass.
- Backend is already complete: `ApproveCandidateDraftDto` takes the four fields, `ApproveDraftAsync` maps them, `Candidates` has the columns. Nothing collects or sends them.

## Decisions
- Scope: frontend only, no migration, no backend change (user chose at planning, 2026-10-13).
- Validation mirrors the three existing call sites: when ticked, reference name required and reference email must pass `EMAIL_REGEX`; Employee ID stays optional.

## Out of scope
- Referral persistence on the draft itself (Save Changes and queue navigation discard it). `CandidateDrafts` has no referral columns; adding them is the follow-up.
- `BulkApproveAsync` hardcoding `false, null, null, null`, which needs those same columns.
- The free-text referrer fields themselves, tracked as issue #157 (GorillaHR directory lookup).

## Follow-ups
- e2e fixture: `Alex_Rivera_Senior_Backend_Engineer.pdf` is rejected on upload with "Could not parse 1 file", so the bulk-upload specs lose a CV.
- `date-picker.test.tsx` timed out once at 15s under full-suite parallel load; passes in 3.7s alone.
