<!-- phase: DONE | branch: fix/RG-36/Duplicate-visibility-icons | tasks: 3/3
     base: 6d4dbae | updated: 2026-09-30
     next: none - fix verified in Edge; awaiting your call on commit/PR -->
# Plan: hide the browser's native password reveal control

## Tasks
- [x] Suppress `::-ms-reveal` / `::-ms-clear` on `input[type='password']` in
      `client/src/index.css`, with a comment saying why ours is the one kept.
- [x] Delete the dead `.password-field .form-control` rules - no call site
      since the Bootstrap removal.
- [x] Verify: tsc, vitest, oxlint, production build, plus a real-Edge check.

## Tests
- None added. The defect is a browser-painted pseudo-element; jsdom does not
  render it, so a Vitest assertion could neither fail on the bug nor pass on
  the fix. Tier: trivial - verified by observation instead.
- Observed in real Edge (Playwright `msedge` channel) against the production
  build: with the rule force-disabled the field shows two eye icons; with it
  applied, one. Toggle still flips to `type=text` with `aria-pressed=true`.

## Files
- `client/src/index.css`
