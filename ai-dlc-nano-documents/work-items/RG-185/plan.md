<!-- phase: DONE | branch: feature/RG-185/Share-evaluations-ui | tasks: 9/9
     base: 065657a | updated: 2026-10-20
     next: user yes to push + PR (Closes #185, Part of #182)
# Plan: RG-185 share and revoke UI (standard rigor; the one new endpoint is read-only but auth-gated, so tested like the others)
## Tasks
- [x] Backend: GET api/candidates/{id}/evaluation-shares/options (non-cancelled interviews with date/tags/panel; active users with alreadyHasAccess + reason), same gates, + service and HTTP tests
- [x] types/index.ts DTOs + api.ts functions (list, create, revoke, options); query key ['evaluation-shares', candidateId], invalidated on create/revoke
- [x] ShareEvaluationsDrawer (Harbor Sheet): SearchableMultiSelect people (disabled "Already has access"), All rounds / Specific interviews, expiry, note (500), server skipped toast and 400 message
- [x] EvaluationSharesList: grantee, scope, source label, granted by, expiry, status, Revoke behind ConfirmModal; revoked/expired collapsed
- [x] Entry points: CandidateDetailPage button beside Evaluation report; report drawer and page header with "Shared with N people"; hidden when !canWriteCandidates
- [x] Vitest: drawer (scope toggle, disabled users, payload shape, skipped toast, server error) and list (revoke confirm)
- [x] E2E: Recruiter shares an interview's round with the Interviewer, sees the row, revokes; desktop and phone widths checked
- [x] Docs: ai-docs/frontend.md (+ backend.md/auth.md for the options endpoint), user guide section in chapter-2-recruiter.md, Admin chapter pointer
- [x] dotnet test + npx tsc -b + npm test + lint, isolated real-stack check (own ports, throwaway DB), notes/backlog
## Tests
- Backend: options endpoint 401/403/404-out-of-scope, cancelled excluded, alreadyHasAccess flags. Frontend: Vitest as above. One E2E on isolated stack.
## Files
- Controllers/EvaluationSharesController.cs, Services/EvaluationShareService.cs, DTOs, tests; client: types, api.ts, components/ShareEvaluationsDrawer + EvaluationSharesList (+tests), CandidateDetailPage, EvaluationReportDrawer, CandidateEvaluationReportPage, e2e spec; ai-docs, UserGuide/chapter-2/3
