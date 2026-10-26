# Links that send users to pages they cannot open: timeline interviewer pills and booker notifications
- Source: issue #198 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/198
- Type: bug (labels: bug, UI)
## Request
- StatusTimeline links every interviewer pill to /interviews/{id}; the API 404s for anyone not assigned and not Admin+ (e.g. the owning Recruiter).
- InterviewService.NotifyBookerAsync links /candidates/{id} without checking the booker can still see the candidate.
- RequireRole redirects to / silently, so a deep link to a forbidden page gives no explanation.
- Wanted: pills as text unless viewer is Admin+ or an interviewer on it; booker link only if they can see the candidate (or no link); RequireRole shows a message after redirecting; Vitest for pills, integration for booker fan-out.
## Decisions
- Pill is a link only for Admin+ or an interviewer on that interview; new optional currentUserId prop -> go with recommendation
- Booker: notify as before, link only if they can still see the candidate (Admin+ or owner/assigned Recruiter), else no link -> go with recommendation
- RequireRole: toast "You don't have access to that page." once per denied visit -> go with recommendation
## Out of scope
- Changing who may open an interview page.
## Follow-ups
