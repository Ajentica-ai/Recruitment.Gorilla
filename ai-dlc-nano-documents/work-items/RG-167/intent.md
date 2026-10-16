# My pipeline cards are not aligned on the dashboard
- Source: issue #167 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/167 (screenshot; label bug)
- Type: bug
## Request
- Dashboard, My pipeline: the left cards (Insights, Offers) end well above the Recent activity card on the right.
- Wanted: aligned bottom edges.
## Decisions
- Root cause: .dash-pair is a grid with align-content:start, so its cards keep natural height while the feed card fills the row.
- Fix: at >=1200px make .dash-pair a flex column whose last card grows (user confirmed plan).
## Out of scope
- Restyling the cards.
## Follow-ups
