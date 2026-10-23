<!-- phase: DONE | branch: feature/RG-186/Shared-with-me-view | tasks: 9/9
     base: 01c680e | updated: 2026-10-21
     next: user yes to push + PR (Closes #186, Part of #182)
# Plan: RG-186 'Shared with me' view (standard rigor; one small backend edit for notification links)
## Tasks
- [x] Backend: EvaluationShared notification gets link /shared/candidates/{id}/evaluations; fan-out link changed from /shared/{id}; update the tests that assert it
- [x] api.ts + types: getSharedWithMe, getSharedReport, getSharedProfile; CV helpers (download/preview) accept a shared mode using api/shared-evaluations/.../cv; query keys ['shared-evaluations', ...]
- [x] SharedEvaluationsPage at /shared/candidates/:id/evaluations (any role): banner (by X, until date, note), report body, read-only profile + CV preview via shared mode; 404 = "expired or revoked" with a normal-report link for canWriteCandidates
- [x] ReadOnlyCandidateProfile + CvPreviewDialog: optional shared mode (no edit, shared CV endpoint)
- [x] Dashboard SharedWithMeCard (hidden when empty or loading), placed under Up next, links to the route
- [x] InterviewPage: "Earlier rounds shared with you" link only when mine has this candidate with visible evaluations
- [x] Vitest: route for Interviewer-only user, banner + note + no-expiry, expired state, dashboard card hidden when empty, interview link only when shared, CV shared mode
- [x] E2E (isolated stack): A and B submit round 1, Recruiter shares with C, C opens the notification and reads both, cannot open /candidates/:id; docs: frontend.md route table, Interviewer user guide section, backend.md/auth.md link note
- [x] dotnet test + npx tsc -b + npm test + lint, isolated real-stack check, notes/backlog
## Tests
- Backend: link assertions. Frontend: Vitest above. One E2E on an isolated stack.
## Files
- Services/EvaluationShareService.cs, Services/InterviewService.cs, tests; client: api.ts, types, pages/SharedEvaluationsPage (+test), App.tsx, ReadOnlyCandidateProfile, CvPreviewDialog, dashboard/SharedWithMeCard (+test), DashboardPage, InterviewPage, e2e spec; ai-docs, UserGuide/chapter-1-interviewer.md
