# Interviewer sent to Candidates page by "View all" in Active Job Openings
- Source: issue #48 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/48
- Type: bug
## Request
- Interviewer clicks Dashboard > Active job openings > "View all" and lands on Candidates. No expected result stated in the issue.
## Decisions
- Cause: link went to /configuration; RequireRole bounced non-admins (to /candidates then, to / since RG-99) -> confirmed
- Fixed by RG-47 (PR #117, merged): link -> /jobs, hidden for roles without /jobs access -> user confirmed no further code
- Verified in Edge via Playwright: Interviewer sees no View all; Admin/Recruiter land on /jobs
## Out of scope
- Giving Interviewers a Jobs page
## Follow-ups
- none
