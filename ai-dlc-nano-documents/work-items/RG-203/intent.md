# My interviews page: interview history with past evaluations for interviewers
- Source: issue #203 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/203
- Type: feature (labels: enhancement, UI)
## Request
- "My interviews" page (any role): tabs Upcoming / Awaiting evaluation / Submitted / Cancelled, search by candidate name, paging.
- Server: paging + status filter on /api/interviews/mine (currently unbounded), cancelled behind a filter.
- Rows link to /interviews/{id}; submitted rows show the recommendation and overall rating the user gave.
- Later: a "Shared with me" tab (#182 phase 4), not now.
## Decisions
- New GET /api/interviews/mine/history (tab, search, page, pageSize); /mine unchanged for the dashboard -> go with recommendation
- Tabs: Upcoming (>= now, soonest first), Awaiting (started, not submitted), Submitted, Cancelled; search by candidate name; page size 1..100; tab counts in the response -> go with recommendation
- Page /my-interviews in the sidebar for every role; tabs/search/page in URL params; Shared-with-me tab out -> go with recommendation
## Findings
- GET /api/interviews/mine is used unbounded by the dashboard (DashboardHero, UpNextCard): its shape must not change.
- A user removed from a panel is no longer an InterviewInterviewers row, so removal is not recoverable here; only cancelled interviews they are still assigned to can be shown.
## Out of scope
- "Shared with me" tab; showing panel removals.
## Follow-ups
