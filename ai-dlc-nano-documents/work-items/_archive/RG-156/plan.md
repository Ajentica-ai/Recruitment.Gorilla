<!-- phase: DONE | branch: fix/RG-156/Referral-on-review-screen | tasks: 7/7
     base: 7256c6c | updated: 2026-10-13
     next: none - verified end to end; commit/PR on request -->
# Plan: referral block on the bulk-upload review screen

Rigor tier: **standard**. Frontend only, no migration, no backend change.

## Tasks
- [x] Widen `editForm` state (L115) from `Partial<CandidateDraft>` to `Partial<CandidateDraft> & ReferralFields`, a local type holding `isReferred` / `referenceName` / `referenceEmail` / `referenceEmployeeId`. `CandidateDraft` has none of them, so the plain `Partial` would not typecheck.
- [x] Seed the four fields in the hydration effect (L217-250) as `false` / `''`, since a draft never carries them. Keeps the reset-on-navigate behaviour honest.
- [x] Render the block at the end of the Application & Job Role Assignment section, after Source Detail (~L1045): `CheckboxField` labelled "Referred by an employee", then Referrer Name, Referrer Email and Employee ID in a `col-span-12` grid, shown only when ticked. Add `CheckboxField` to the existing `@/components/ui/field` import.
- [x] Validate in `handleApprove` (L394-410): when ticked, `validatePersonName(referenceName, 'Reference name')` (already imported) and the file's existing inline email regex for the referrer email. Employee ID stays optional. Errors go through the existing `formErrors` map so `Field error=` renders them.
- [x] Add the four fields to the approve payload (L412-436), nulling the three sub-fields when the box is unticked, matching `CandidateService`'s own rule.
- [x] Relabel the checkbox to "Referred by an employee" in `CandidateForm.tsx` (L306) and `CandidateDetailPage.tsx` (L643) so all four sites agree.
- [x] Run `npx tsc -b` and the full Vitest suite; verify end to end in the running app by approving a referred draft and checking the candidate profile.

## Tests
- New `client/src/components/drafts/DraftReviewWorkspace.test.tsx`: the four fields reach the approve payload; sub-fields are null when unticked; approve is blocked with a ticked box and a missing name or a malformed email. No suite exists for this component today (`UploadPage.test.tsx` mocks it out entirely).
- Full `npm test` must stay green, especially `CandidateForm.test.tsx` given the label change.

## Files
- `client/src/components/drafts/DraftReviewWorkspace.tsx` (the whole change)
- `client/src/components/drafts/DraftReviewWorkspace.test.tsx` (new)
- `client/src/components/CandidateForm.tsx`, `client/src/pages/CandidateDetailPage.tsx` (label only)
