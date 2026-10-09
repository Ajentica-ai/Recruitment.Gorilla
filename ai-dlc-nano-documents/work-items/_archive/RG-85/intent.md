# Convert the four heavy form dialogs to drawers (4 of 15 surfaces)
- Source: issue #85 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/85
- Type: feature (label `enhancement`)

## Request
Move four heavy form dialogs onto the `Sheet` primitive, four of fifteen overlay
surfaces. Each needs an explicit `sm:` width, since the drawer default is 28rem:
status 42rem, offer 42rem, rubric editor 52rem, job opening 42rem.
Prerequisites both merged: #81 (PR #86), #84 (PR #87).

## Decisions
- All four in one branch and PR. The edit is mechanical and identical in each file,
  so the risk is uniform and one review and verification pass covers it.
- Candidate detail page: "Advance Stage" closes the status-history drawer, and the
  history drawer **reopens** once the status drawer closes, showing the new entry on
  save and unchanged on cancel. Keeps the reader's place in the timeline.
- Job opening editor is included, for consistency with the rubric editor beside it.
- The mapping is 1:1: all four use only the six Dialog parts that have Sheet
  equivalents. The `className="contents"` wrappers from #81 stay, since `SheetBody`
  carries the same `flex-1 min-h-0` contract.

## Out of scope
- The 6 `ConfirmModal` call sites: a destructive confirm should interrupt centrally.
- CV preview, offer decision, edit user, reset password, option chip editor.

## Follow-ups
- Rubric criterion descriptions still clip at 52rem. The issue predicted the wider
  panel would un-truncate them; it helps ("...and practical exper" vs "...and pr")
  but the input is a fixed-width cell in a flex row, so widening the panel alone
  cannot fix it. Needs the criterion row to reflow or the description to span.
