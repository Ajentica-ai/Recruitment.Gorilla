# Dashboard redesign: action-first, mobile-first and interactive
- Source: issue #134 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/134
- Type: feature
## Request
- Rebuild `/` so the first screen shows what needs the user today (evals due, next interview), then KPIs with weekly change, then pipeline health.
- Mobile first: KPI and open-role strips scroll-snap on phone, floating Upload CVs below 768px; grids from 560px up.
- Interactive: Mine/Team, All/Active stages, tappable pipeline, trend bar readout, Roles/Skills tabs, grouped activity, refresh.
- Signed-off mockup: canvas https://claude.ai/artifact/3ecPJsHbdiJimz27V9edZu, screenshots on branch `assets/dashboard-redesign-mockups`.
## Decisions
- Layout direction → action-first feed (user, 2026-10-10)
- Backend scope → small additive API only: KPI weekly deltas + `GET /api/dashboard/applications-summary` (user)
- Mockup before code → done, issue filed with screenshots (user)
- Up next Mine → future assigned interviews by day + past non-submitted under "Awaiting evaluation"; submitted past hidden
- Up next Team → existing scoped upcomingInterviews; no toggle for Interviewers
- Recommended/Rejected weekly delta → candidates whose FIRST entry into the bucket is within 7d
- New-this-week delta → last 7d vs the 7d before; open roles: first 6 by end date
- Local browser time; count-up off under reduced motion; standard test tier
- Backlog RG-99 'View all' line is moot (card hidden from Interviewers) → delete at WRAP-UP
- Hero "N evaluations to complete" now counts the same set as "Awaiting evaluation" (past, not submitted)
## Out of scope
- Customisable layout, mobile bottom tab bar, existing `max-width` queries, stale bootstrap/teal docs refresh.
## Follow-ups
- KPI figures are org-wide while a Recruiter's drill-through list is owner-scoped (pre-existing) → backlog
- CountBarChart keeps a fixed tall height for one bar (Insights card) → backlog
