# Users table column headers misaligned with their data
- Source: issue #41 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/41 (labels: Improvements, UI; no Bug label)
- Type: bug (treated as bug, like the same-pattern RG-52)
## Request
- Users table: Name, Email, Roles, Status, Last login headers sit shifted from their left-aligned data.
- Expected: each header lines up with its column.
## Decisions
- Root cause: .table>thead th has no text-align, so the browser centres <th>; the <td> content is left-aligned.
## Out of scope
- Restyling the table.
## Follow-ups
- Same bare <th> pattern in AuditLogPage, EmailDeliveryTab (likely same misalignment).
