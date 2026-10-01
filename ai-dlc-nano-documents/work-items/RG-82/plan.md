<!-- phase: WRAP-UP | branch: fix/RG-82/Rubric-section-header | tasks: 4/4
     base: ab8fbe6 | updated: 2026-10-01
     next: summarise; nothing committed yet, commit and push need approval -->
# Plan: Rubric editor rows reflow at narrow widths

Rigor tier: **standard**. A layout bug with measurable symptoms, so it gets the same
geometric treatment as RG-72 and RG-81: numbers, not screenshots.

Root cause for both rows is the same shape: a single non-wrapping flex row with cells
that are allowed to shrink below their content.

## Tasks
- [x] Section header (`EvaluationRubricsTab.tsx` ~line 645): let the row wrap so the
      actions drop to a second line when there is no room, give the "Section N" chip
      `shrink-0` and `whitespace-nowrap` so it can never wrap inside its own
      background, give the actions group `shrink-0`, and let the name input use the
      width that frees up instead of being squeezed to 125px.
- [x] Criterion row: rebalance the grid from `md:col-span-5 / 5 / 2` to `4 / 6 / 2` so
      the description gets roughly 336px against the 311px it needs. Also drop the
      duplicate `gap-4 gap-2` on that grid, where `gap-4` is dead.
- [x] `e2e/rubric-editor-layout.spec.ts`: at 360 and 390 assert the chip is one line
      tall and the name input is not truncated; at 1280 assert the description input
      does not clip. All three assertions fail today.
- [x] Verify + docs: `npx tsc -b`, `npm test`, `npm run lint`, the new spec plus
      `drawer-forms`, `dialog-footer-visible`, `drawer-mobile` and `smoke`; visual
      check at 360 / 390 / 1280 in both themes. Then delete the resolved backlog line
      and update the 436 file count.

## Tests
- New: `e2e/rubric-editor-layout.spec.ts`, red before the fix on all three assertions.
- Existing: full Vitest suite, plus the drawer and dialog specs, since this edits a file
  #85 just converted.

## Files
- `client/src/pages/configuration/EvaluationRubricsTab.tsx`
- `client/e2e/rubric-editor-layout.spec.ts` (new)
- `ai-dlc-nano-documents/backlog.md` (delete the resolved RG-85 line)
