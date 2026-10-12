<!-- phase: DONE | branch: fix/RG-138/Datepicker-and-label-fixes | tasks: 4/4
     base: 308027d | updated: 2026-10-11
     next: none. PR #140 merged into develop @d35c517. -->
# Plan: Datepicker double icon (Firefox) + skills-selected mislabels (RG-138)
## Tasks
- [x] 1. `ui/date-picker.tsx`: detect Firefox (`navigator.userAgent`); when true, don't render the
      custom Popover/calendar button, leaving only Firefox's own native icon+picker. No change for
      Chromium/WebKit (confirmed 1 icon there already).
- [x] 2. `SearchableSelect.tsx`: add an `itemNoun` prop to `SearchableDropdown` (default `'skills'`,
      so the 5 real skills pickers need no change) and thread it through `SearchableMultiSelect`;
      use it in the `"N ${itemNoun} selected"` summary.
- [x] 3. Pass the correct noun at the 3 wrong call sites: `AddStatusModal.tsx` Interview types
      (`"interview types"`) and Interviewers (`"interviewers"`); `JobOpeningsTab.tsx` Recruiters
      (`"recruiters"`).
- [x] 4. Tests: `date-picker` (new) - custom button renders on a non-Firefox UA, not on Firefox;
      `SearchableSelect.test.tsx` - a custom `itemNoun` changes the summary text, default stays
      "skills" (regression guard for the 5 unchanged call sites).
## Tests
- Standard tier. New Vitest cases per above; full `npm test` run. Manually re-verified against the
  Firefox/Chromium/WebKit repro already captured for the issue.
## Files
- `client/src/components/ui/date-picker.tsx` (+ new test file)
- `client/src/components/SearchableSelect.tsx`, `SearchableSelect.test.tsx`
- `client/src/components/AddStatusModal.tsx`
- `client/src/pages/configuration/JobOpeningsTab.tsx`
