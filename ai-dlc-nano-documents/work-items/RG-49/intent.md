# Interviewer login lands on the page the previous user logged out from
- Source: issue #49 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/49
- Type: bug
## Request
- Recruiter logs out from /candidates|/jobs|/upload; an Interviewer then signs in and is sent to the Candidates page.
## Decisions
- Repro (Edge, develop @ RG-99): after logout the login page still carries history state {from:'/candidates'}; the Interviewer is sent there, then bounced to / by RequireRole. Visible symptom reduced by RG-99; root cause (stale from) remains. Fix: explicit logout no longer saves `from` (AuthContext.loggedOut + ProtectedLayout) - user approved
## Out of scope
- Same-user session-expiry return-to-page (that use of `from` stays)
## Follow-ups
- none yet
