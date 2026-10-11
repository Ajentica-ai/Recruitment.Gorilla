# Applications chart x-axis date labels overlap on responsive view
- Source: issue #71 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/71
- Type: bug (label: bug, UI)

## Request
- Issue body is a screenshot (dashboard "Applications" chart at 425px width):
  a line chart whose x-axis prints every single date ("Aug 1", "Aug 15",
  "Aug 22", ...), overlapping and unreadable.

## Finding (CLARIFY)
Already fixed. The dashboard was rebuilt by commit `b749e19` ("Redesign the
dashboard: action-first and mobile-first (RG-134)"), already on `develop`
since 2026-10-10 - after this issue (filed 2026-09-14) but unrelated to it.
`TrendChart.tsx` is now a bar chart (not the old line/area chart) whose
x-axis (`.trend-axis`) renders exactly 3 labels (first/mid/last date) laid
out with `justify-content: space-between`, so it cannot overlap regardless
of width or date range. Verified live at the exact reported viewport
(425px): axis showed `["Sep 12", "Sep 26", "Oct 11"]`, no overlap.

## Decisions
- Close #71 as already-fixed with an explanatory comment, no code change -> user confirmed.

## Out of scope
- n/a - no code change identified as needed.

## Follow-ups
- none
