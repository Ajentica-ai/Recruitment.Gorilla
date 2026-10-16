# Recruitment Gorilla Release Notes

## Version 1.0 (2026-10-02)

This is the first release of Recruitment Gorilla. It is a recruitment management system that takes candidates from a CV upload all the way to a hire.

### What's included

- **CV intake:** bulk upload of PDF and Word CVs. Candidate details are extracted automatically into drafts, which you review and then approve or discard.
- **Candidates:** a searchable list with filtering and sorting, CV preview, source tracking, and a status history timeline.
- **Job openings:** a role hierarchy with configurable roles, skills and status colours.
- **Pipeline:** a kanban board of candidates by stage, with alerts on bottleneck stages.
- **Interviews:** scheduling with calendar invites, evaluations scored against a custom rubric for each job opening, and an evaluation report per candidate.
- **Offers:** create and track offers through to hire.
- **Dashboard and analytics:** KPI tiles, stage performance, active job openings, your upcoming interviews, recent activity, and hiring velocity and funnel metrics.
- **Notifications:** in-app notifications (including when an evaluation is submitted) and transactional email, with SMTP settings managed by an admin.
- **Users and access:** Super Admin, Admin, Recruiter and Interviewer roles. Recruiters work with the candidates they own or that belong to the job openings they are assigned to, and with the CV drafts they uploaded. Only an Admin or Super Admin can approve an offer. Dashboard summary counts cover the whole organisation for every role.
- **Audit trail** of key actions, plus a user guide for each role.
- **Interface:** light and dark themes, with layouts that work on phones (forms open as bottom sheets on small screens).

### Security

- Sign-in uses short-lived access tokens and an httpOnly refresh cookie.
- Secrets are kept out of source code.
- The backend is never exposed to the network. Only the web front end is reachable, and under Docker it binds to localhost.

### Getting started

1. Run `docker compose up --build`.
2. Open `http://localhost:8090`.
3. Sign in with the default admin account (see the setup guide), then change its password straight away.

### Known issues

- The CV parser can shorten an education institution's name to a single word.
- Interviewers see a blank page after signing in. Open the Dashboard from the menu (#99).
- Creating a candidate whose email already exists shows that candidate's details, even when they belong to another recruiter (#98).
- Analytics filtered to a single job opening is not limited to the recruiter's own openings (#96), and the team workload figures count activity across the whole organisation (#101).
- The server does not yet check that a recruiter is assigned to the job opening they file a candidate under. The form only offers their own openings (#97).
- Some status lookups confirm that a candidate exists to users who cannot open it (#100).
