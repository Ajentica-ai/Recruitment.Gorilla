# Candidates list: unvalidated paging and the board silently truncates at 150
- Source: issue #196 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/196
- Type: bug (labels: bug, UI)
## Request
- `page=0`/negative gives a negative Skip and a 500; `pageSize` is unbounded (whole DB in one response).
- The board asks for pageSize 150 and silently drops everyone beyond it.
- Wanted: clamp page >= 1, pageSize 1..200; board paginates per column, or at least shows "Showing 150 of N".
## Decisions
(pending CLARIFY)
## Out of scope
- Per-column "load more" on the board (the issue allows the notice instead).
## Follow-ups
