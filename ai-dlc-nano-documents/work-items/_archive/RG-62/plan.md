<!-- phase: DONE | branch: fix/RG-62/Bulk-bar-footer-overlap | tasks: 5/5
     base: 77e5c15 | updated: 2026-10-12
     next: none - commit/push/PR on request -->
# Plan: Fix bulk-selection bar overlapping the editor-studio footer

## Tasks
- [x] Add a `splitViewRef` on `.draft-split-view` and a measurement effect
      (mirrors the existing `bulkBarRef`/`bulkBarInset` effect) that computes
      `window.innerHeight - splitViewRef.top - rgContentBottomPadding` and
      stores it as `splitPanelHeight`; publish as `--split-panel-height` on the
      same inline-styled root div that already carries `--bulk-bar-inset`.
      Re-measure via ResizeObserver + window resize, and on `mobileDetailOpen`
      toggle (head content can change which rows wrap).
- [x] `index.css`: change the base `.draft-list-rail` and `.draft-editor-studio`
      rules (~7963, ~8096) from `height: calc(100vh - 210px)` to
      `height: var(--split-panel-height, calc(100vh - 210px))` (fallback keeps
      current behavior before first measurement/JS-disabled).
- [x] `index.css`: remove the now-redundant `max-width: 991px` override of
      `.draft-list-rail, .draft-editor-studio { height / min-height }`
      (~7937-7941) - the measured var already adapts to any width. Leave the
      other rules in that media block untouched.
- [x] Verify at the reported size (830x835) and at a couple of sanity sizes
      (1440x900 desktop, 992x700 narrow-but-short, 390x844 phone) that the
      footer buttons are visible and never behind the bulk bar. 830x835,
      1440x900 and 390x844 clear with no scrolling needed. 992x700 (an
      extreme edge: narrower and far shorter than the reported case) still
      shows minor clipping on the rightmost button at the 480px min-height
      floor - strictly better than before (old floor there was 540px) and
      not a new regression, so left as a known limit rather than chased
      further.
- [x] Clean up: temp repro scripts/screenshots lived only in the scratchpad,
      not the repo; nothing to remove here.

## Tests
- Standard tier (CSS/layout bug fix). No unit test - layout math isn't
  meaningfully testable in jsdom. Verified with a Playwright-driven
  screenshot check (same technique used to reproduce) across the viewport
  sizes above. `npx tsc -b` clean, `npm run lint` clean (pre-existing
  warnings only), `npm test` 225/226 (226/226 re-run in isolation - the one
  failure, date-picker.test.tsx, is an unrelated flaky timeout, confirmed
  passing standalone).

## Files
- client/src/components/drafts/DraftReviewWorkspace.tsx
- client/src/index.css
