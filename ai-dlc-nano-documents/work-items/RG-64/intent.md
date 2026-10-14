# Per-page dropdown list leaves the browser window
- Source: issue #64 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/64 (screenshot only; labels bug, UI)
- Type: bug
## Request
- The "Show N per page" list (native select) is cut off or overhangs the window when the pager sits near the bottom.
- Wanted: the list stays inside the browser window.
## Decisions
- Native <select> lists are drawn by the browser/OS and cannot be constrained -> replace with the app's Radix Select (collision-aware, capped height) (user confirmed)
- Scope: shared Pagination component only; other native selects stay native (user confirmed)
## Out of scope
- Other NativeSelect usages.
## Follow-ups
