# Interviewers are redirected to /candidates and land on a blank page
- Source: issue #99 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/99
- Type: bug
## Request
- RequireRole sends users lacking a role to /candidates, itself Recruiter+ only, so Interviewers get an empty shell.
- LoginPage defaults the post-login target to /candidates, so every Interviewer sign-in lands there.
- Docs (frontend.md, auth.md) say Interviewers reach the dashboard; land on / (Dashboard) instead.
## Decisions
- Fallback target? -> Dashboard `/` for every role (RequireRole, LoginPage default).
- Siblings? -> fix ChangePasswordPage post-change redirect too; Dashboard 'View all' left out.
## Out of scope
- Dashboard Recent activity 'View all' still links Interviewers to /candidates.
## Follow-ups
- DashboardPage Recent activity 'View all' sends Interviewers to /candidates (now bounces to /).
