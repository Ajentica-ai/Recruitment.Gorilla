# Analytics: "Recruiter" column header misaligned with its data
- Source: issue #52 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/52 (screenshot only, no text)
- Type: bug (labels: bug, UI)
## Request
- Recruiter Productivity & Pipeline Workload table: the "Recruiter" header sits centred over cells that are left-aligned (avatar + name). Header should line up with its data.
## Decisions
- Cause: first <th> has no alignment (browser centres it) while its <td> content is left-aligned (AnalyticsPage.tsx ~L452) -> left-align the header and match the cell's 12px padding (user approved)
- Sibling: "Sourcing Channel" header in the Sourcing table has the same mismatch -> fix both (user approved)
## Out of scope
- Other columns (centred header over centred data is fine), table styling
## Follow-ups
- none yet
