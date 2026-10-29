<!-- phase: DONE | branch: fix/RG-238/Drawer-forms-offer-stage | tasks: 2/2
     base: fdeeec2 | updated: 2026-10-29
     next: user decides push + PR -->
# Plan: fix drawer-forms draft-offer seeding
## Tasks
- [x] Add `advanceToRecommended(request, auth, candidateId, interviewerEmail)` to `client/e2e/seed.ts`:
      Call for Interview -> Interview Scheduled (one interviewer) -> submit a rubric evaluation ->
      Interview Completed -> Recommended, mirroring `shared-with-me.spec.ts`'s `bookAndShare`.
- [x] Call it from both `drawer-forms.spec.ts` viewport tests right after `seedCandidate`, before
      the forms loop opens the draft-offer sheet.
## Tests
- Standard tier: the two existing drawer-forms tests are the regression test. Verified red-then-green
  against an isolated throwaway DB: unfixed spec times out on Draft Offer (issue's symptom); fixed
  spec passes all 3 (phone, short laptop, history drawer). tsc + oxlint clean.
## Files
- client/e2e/seed.ts
- client/e2e/drawer-forms.spec.ts
