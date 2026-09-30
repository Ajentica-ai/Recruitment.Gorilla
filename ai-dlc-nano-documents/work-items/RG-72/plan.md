<!-- phase: WRAP-UP | branch: fix/RG-72/Responsive-interview-header | tasks: 6/6
     base: 8a35295 | updated: 2026-09-30
     next: none - all tasks done and verified; awaiting the user on commit/push -->
# Plan: Responsive interview header and chip icon
Root causes, measured not guessed: `CardHeader` is a one-row flex whose
`CardAction` is `shrink-0` (constant 281px here), so the title absorbs every
pixel of loss and collapses to 0px at 320. And `.interview-chip`'s inline
`<svg>` has no `flex-shrink: 0`, so it squashes 15px -> 13.8px at 320.
## Tasks
- [x] `ui/card.tsx` `CardHeader`: allow wrap so actions drop below the title
      instead of crushing it; give the title wrapper a flex-basis so it wraps
      rather than shrinking to nothing. Keep the 1-row look above the breakpoint.
- [x] `index.css` `.interview-chip svg`: `flex-shrink: 0` + align to the first
      text line (`align-self: flex-start` with the line's half-leading offset)
- [x] `index.css`: delete the duplicate `.required-star` at :125 (identical to
      :1105, which wins the cascade today) - clears a backlog line
- [x] `e2e/responsive-interview.spec.ts` (new): assert title width > 0 and icon
      width == 15 at 320/360/390/405
- [x] Re-measure with the repro sweep; confirm the issue screenshot is gone
- [x] Visual check of the other 7 SectionCard-with-actions consumers at 390px
## Tests
Standard tier. A unit test cannot see a collapsed flex child, so the regression
test is a Playwright measurement (the same one that reproduced this), following
the existing env-gated e2e pattern. Plus full `npm test` + `tsc -b` + oxlint.
## Files
- `client/src/components/ui/card.tsx`
- `client/src/index.css` (`.interview-chip`, duplicate `.required-star`)
- `client/e2e/responsive-interview.spec.ts` (new)
## Risk noted
`CardHeader` backs 13 files and 11 `actions=` usages (dashboard, users,
configuration, evaluation report). The last task exists because a shared-layout
change can regress a page nobody looked at.
