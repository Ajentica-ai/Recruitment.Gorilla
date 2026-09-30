# Calendar icon misaligned and Interview Evaluation text overlapped in responsive view
- Source: issue #72 https://github.com/tahmidsparrow/Recruitment.Gorilla/issues/72
- Type: bug (labelled `bug`; board column Backlog)
## Request
Two separate responsive defects on the Interview page, both reproduced with
Playwright against the running app (interview 1, admin@recruitmentgorilla.com):
- **Header overlap.** `SectionCard`'s `CardHeader` is a single-row flex; its
  `CardAction` is `shrink-0` and `.eval-progress__count` is `white-space: nowrap`,
  so the actions hold a constant 281px at every width. The title is crushed
  (measured `titleW` 0px at 320, 47px at 390) and "Interview evaluation" wraps
  to two lines whose text overflows the collapsed box and sits under the badges.
- **Calendar icon.** `.interview-chip` is `inline-flex; align-items: center` and
  the inline `<svg>` has no `flex-shrink: 0`, so at 320px the icon is squashed
  from 15px to 13.8px. When the chip wraps to two lines the icon also centres
  against the whole block instead of the first line.
## Decisions
- Fix the shared `CardHeader`, not just the evaluation card: any SectionCard
  with wide actions has the same bug, so a local override would leave it latent.
- Calendar icon: never shrink (`flex-shrink: 0`) AND align to the first text
  line, so a wrapped two-line chip does not leave it floating mid-block.
- Fold in the backlog's duplicate `.required-star` (same file, no behaviour
  change) and clear that backlog line.
## Out of scope
- Any other responsive defect not in the issue screenshot.
- Redesigning the evaluation header's badges.
## Follow-ups
- A dashboard-only version of the header test PASSED against the unfixed code:
  the dashboard's card actions are small enough to fit, so it never crushed the
  title. The test only bites on the interview page. Any future "responsive"
  assertion needs to name the surface that actually shows the defect.
- `.eval-progress__count` keeps `white-space: nowrap`, so the actions row is a
  fixed 281px. The header now wraps around it rather than fighting it, but a
  narrower badge set would let title and actions share a row further down.
- `CardAction` is `shrink-0` by design; nothing else in the app currently has
  actions wide enough to hit this, but the next wide action set will.
