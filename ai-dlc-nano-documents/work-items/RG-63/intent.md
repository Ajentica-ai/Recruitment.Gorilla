# Candidates table column headers misaligned with their data
- Source: issue #63 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/63 (screenshot only; labels bug, Improvements, UI)
- Type: bug
## Request
- Candidates table: Name, Email, Current title, Status, Added headers sit off their left-aligned data.
- Expected: each header lines up with its column.
## Decisions
- Root cause: .table>thead th sets no text-align, so <th> is centred while <td> content is left-aligned (same as RG-41 Users, RG-52 Analytics).
- Sort headers are <button class="th-sort"> inside the <th>, so the th text-align must reach them.
## Out of scope
- Restyling the table.
## Follow-ups
- Audit Log and Email Delivery tables share the bare <th> (already in backlog, found: RG-41).
