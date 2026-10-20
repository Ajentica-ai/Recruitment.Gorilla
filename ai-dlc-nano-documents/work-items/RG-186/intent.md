# Evaluation sharing 4/5: 'Shared with me' view for grantees, including Interviewers
- Source: issue #186 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/186 (Part of #182, phase 4 of 5)
- Type: feature (UI)
## Request
- Route /shared/candidates/:id/evaluations (any authenticated role): shared report + read-only profile + CV, banner "Shared with you by X, until <date>" with note; 404 shows "expired or revoked", no redirect.
- Dashboard "Shared with me" card from GET api/shared-evaluations/mine, hidden when empty.
- InterviewPage: "Earlier rounds" link to the shared report when the assigned interviewer also holds a grant (server enforces the peer rule).
- Notification deep links (EvaluationShared and the submit fan-out) open the new route.
- Admin+/in-scope Recruiter keep /candidates/:id/evaluations; the shared route works for them too.
- Vitest per issue; one E2E (A and B submit round 1, Recruiter shares with C Interviewer, C reads via the notification, cannot open /candidates/:id). Docs: frontend.md route table, Interviewer user guide section.
## Decisions
- Notification links → both the EvaluationShared notification (now linkless) and the submit fan-out (/shared/{id}) point to /shared/candidates/{id}/evaluations; small backend change + test updates (user: go with recommendation)
- Navigation → no new sidebar item; entry points are dashboard card, notification, interview page link
- Shared route for Admin/in-scope Recruiter without a grant → expired/revoked message plus a link to the normal report
- CV for grantees → shared CV endpoint (add a "shared" mode to the CV helpers, CvPreviewDialog and ReadOnlyCandidateProfile, no second component)
- E2E → Admin + Recruiter submit as A and B, E2E Interviewer is C, interview created via status API; isolated stack only; fall back to a shorter spec if setup is too fragile
- Banner with no expiry → "Shared with you by X" without "until"
- Branch → feature/RG-186/Shared-with-me-view from origin/develop
## Out of scope
- Auto-share when booking (#187). Backend beyond notification links.
## Follow-ups
- Dashboard shows org-wide KPI tiles to an Interviewer-only user (existing behaviour, seen while testing).
- shared-with-me E2E consumes one Uploaded candidate per run and books a real interview: throwaway DB only.
