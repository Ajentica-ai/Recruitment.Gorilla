<!-- phase: DONE | branch: feature/RG-85/Form-dialogs-to-drawers | tasks: 7/7
     base: aae3a90 | updated: 2026-10-01
     next: summarise; nothing committed yet, push and PR need approval -->
# Plan: Convert the four heavy form dialogs to drawers

Rigor tier: **standard**. Mechanical per file, but it moves four live forms onto a
different primitive, so each gets verified behaviour rather than just a passing build.

## Tasks
- [x] `AddStatusModal.tsx` to Sheet at `sm:w-[min(42rem,100vw)]`. Six Dialog parts map
      1:1 to their Sheet equivalents. Keep the `className="contents"` form wrapper.
- [x] `CreateOfferModal.tsx` to Sheet at `sm:w-[min(42rem,100vw)]`.
- [x] `EvaluationRubricsTab.tsx` editor to Sheet at `sm:w-[min(52rem,100vw)]`.
- [x] `JobOpeningsTab.tsx` editor to Sheet at `sm:w-[min(42rem,100vw)]`.
- [x] `CandidateDetailPage.tsx`: reopen the status-history drawer once the status
      drawer closes, on save and on cancel. Today it closes history and leaves it
      closed. The Kanban caller has no history drawer and needs no change.
- [x] `e2e/drawer-forms.spec.ts`: for each converted form, assert it is a bottom sheet
      on a phone (bottom-anchored, not full-height) and that its footer sits inside the
      viewport at 390x844 and 1279x634. Reuses the geometric approach and the animation
      wait from `drawer-mobile.spec.ts`. Seeds one candidate, deletes it in `finally`.
- [x] Verify + docs: `npx tsc -b`, `npm test`, `npm run lint`, the new spec plus
      `drawer-mobile`, `dialog-footer-visible` and `smoke`; manual pass over all four at
      390 and 1280 in both themes. Then `ai-docs/frontend.md` and the 433 file count.

## Tests
- New: `e2e/drawer-forms.spec.ts`, red before the conversion (the forms are centred
  dialogs, so the bottom-anchored assertion fails).
- Existing: full Vitest suite. `JobOpeningsTab.test.tsx` touches the editor and may
  need its queries adjusted; it is the one unit test in the blast radius.

## Files
- `client/src/components/AddStatusModal.tsx`, `components/offers/CreateOfferModal.tsx`
- `client/src/pages/configuration/EvaluationRubricsTab.tsx`, `configuration/JobOpeningsTab.tsx`
- `client/src/pages/CandidateDetailPage.tsx`
- `client/e2e/drawer-forms.spec.ts` (new), `ai-docs/frontend.md`
- Carry forward: cherry-pick `c80d5c5` so RG-84's trail lands on develop
