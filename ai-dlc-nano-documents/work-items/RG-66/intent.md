# Row actions menu overlaps another candidate row
- Source: issue #66 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/66 (screenshot only; labels Improvements, UI; assigned by user)
- Type: bug (treated as bug, like RG-41/RG-63)
## Request
- Clicking the row's ... icon opens a "Delete candidate" popup that covers another candidate's row.
- Sibling: #65 (phone card layout) fixed by opening the shared menu upward; upward still floats over the row above.
## Decisions
- Open the shared RowActions menu to the LEFT of the trigger so it sits on its own row (user confirmed).
## Out of scope
- Restyling the menu.
## Follow-ups
