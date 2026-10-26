# Cancelled interviews can still be evaluated and submitted, and count in the candidate's report
- Source: issue #189 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/189
- Type: bug
## Request
- UpsertEvaluationAsync never checks interview.Status, so an assigned interviewer can save and submit on a cancelled interview; it counts in the candidate report and fires "Evaluation submitted".
- GetDetailAsync returns CanEvaluate = isAssigned regardless of status, so InterviewPage renders the full form; relativeLabel says "Completed" for any past interview, so a past cancelled one shows "Cancelled" and "Completed" together.
- Expected: Upsert returns 409 "This interview was cancelled." for a cancelled interview; CanEvaluate = isAssigned && Status != Cancelled; the report skips cancelled interviews (defensive, existing bad rows); the page shows a read-only "This interview was cancelled" panel and never "Completed" for it. Optionally delete drafts on cancel.
- Tests: integration 409 on save and submit, report excludes cancelled; Vitest: no form for a cancelled interview.
## Decisions
- Fix as the issue specifies: 409 on save/submit, CanEvaluate excludes cancelled, report skips cancelled, read-only cancelled panel, no "Completed" for a cancelled interview; existing bad rows only ignored, not deleted (user: go with recommendation)
- Drafts on cancel → keep them (not deleted); edits are simply blocked
- Cancelled panel does not show the reason (detail DTO lacks it; the panel got it in the notification)
- Branch → fix/RG-189/Cancelled-interview-evaluation from origin/develop
## Out of scope
- Cleaning existing bad rows in the database (the report ignores them).
## Follow-ups
