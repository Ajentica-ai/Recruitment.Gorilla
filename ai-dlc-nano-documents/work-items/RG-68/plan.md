<!-- phase: DONE | branch: fix/RG-68/Eval-actions-spacing | tasks: 6/6
     base: 27d2e9b | updated: 2026-10-14
     next: none - gap fixed and measured; commit/PR on request -->
# Plan: restore the evaluation actions row styling

Rigor tier: **standard**. CSS-only source change. This exact defect already shipped unnoticed once (commit `33ed80a` renamed the class and dropped the styling), so it gets a measured regression test rather than an eyeball check.

## Tasks
- [x] Reproduce first: load the interview evaluation page in the running app and capture a before screenshot at 1280 and 390, confirming the buttons touch and that the desktop footer is not pinned.
- [x] Add the missing rules to `client/src/index.css`, beside the other `eval-*` blocks (around the `.eval-panel` group, not next to the generic `.form-actions`):
  - `.eval-form-actions` — `display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap: var(--space-3); margin-top: var(--space-5); padding-top: var(--space-5); border-top: 1px solid var(--border)`, mirroring `.form-actions` (index.css:3470) so the row reads the same as every other form footer.
  - `.eval-form-actions__hint` — `flex: 1 1 16rem; min-width: 0` so the hint takes the slack and wraps instead of squeezing the buttons.
  - `.eval-form-actions__buttons` — `display:flex; gap: var(--space-2); flex-shrink: 0`, which is the gap the issue is about.
  - Narrow viewport: below 576px let the buttons group go full width and the hint sit above it. Note that `.form-actions > .btn` never applied here, since the shadcn `Button` emits no `.btn` class.
- [x] Repoint the orphaned selector at `index.css:5500`: `.eval-form-card .form-actions` -> `.eval-form-card .eval-form-actions`, so the `flex-shrink: 0` that pins the footer in the >=992px sticky-card layout matches again.
- [x] Tidy the stray formatting on the second `<Button>` in `EvaluationForm.tsx` (blank line after the tag, misindented `>`). No behaviour change, it is in the block being fixed.
- [x] Add `client/e2e/eval-actions-spacing.spec.ts`, following `rubric-editor-layout.spec.ts`: measures the gap at desktop and phone width. The footer-pinning assertion was written, failed against the fix, and was **removed**: pinning needs `.interview-grid`, which nothing applies. Needs its own interviewer account (`E2E_INTERVIEWER_*`, added to the gitignored env and the tracked example) because the form only renders for an assigned interviewer.
- [x] Verify: after screenshots at both widths, `npx tsc -b`, `npm run lint`, full `npm test`.

## Tests
- E2E geometry assertion as above. **No Vitest test**: jsdom does not apply `index.css`, so a unit test cannot observe a gap that comes from the stylesheet. Asserting the class name alone would pass today, while broken.

## Files
- `client/src/index.css` (the fix: new rules + one selector repointed)
- `client/src/components/EvaluationForm.tsx` (formatting only)
- `client/e2e/eval-actions-spacing.spec.ts` (new)
