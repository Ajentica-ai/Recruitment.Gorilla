# Analytics: funnel progress bar is shown when conversion is 0%
- Source: issue #51 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/51 (screenshot only, no text)
- Type: bug (labels: bug, UI)
## Request
- Analytics > Pipeline funnel: every stage with "0% conversion" still draws a purple sliver under it. A 0% stage should show an empty track.
## Decisions
- Cause: AnalyticsPage.tsx sets the fill width to Math.max(4, percent), forcing a 4% fill at 0 -> width 0 when percent is 0, keep the 4% floor for any value above 0 (assumed, pending confirm)
## Out of scope
- Funnel layout/colours, the % connectors between stages
## Follow-ups
- none yet
