# Evaluation sharing 3/5: share and revoke UI on the candidate page and report
- Source: issue #185 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/185 (Part of #182, phase 3 of 5)
- Type: feature (UI)
## Request
- Recruiters (in scope) and Admins can share, review and revoke evaluation access from where they already read evaluations.
- Entry points: CandidateDetailPage (next to "Evaluation report"), and EvaluationReportDrawer / CandidateEvaluationReportPage header with a "Shared with N people" line.
- Share drawer (Harbor Sheet): people multi-select, all rounds vs specific interviews, optional expiry and note, server skipped list and 400 message shown.
- Current shares list with Revoke behind a confirm; revoked/expired collapsed by default.
- api.ts + types, query key ['evaluation-shares', candidateId]; hidden when !canWriteCandidates.
- Vitest for drawer and list, one E2E, ai-docs/frontend.md and a user guide section.
## Decisions
- Gaps found (no interview list for the picker, no "already has access" flag) → add ONE small read endpoint GET api/candidates/{id}/evaluation-shares/options (interviews + users with alreadyHasAccess), same gates as the other share endpoints, tested (user: go with recommendation)
- Source label → Manual = "Shared manually", PanelAutoShare = "Auto: panel" until #187 supplies the round (user: go with recommendation)
- User guide → new "Sharing evaluations" section in chapter-2-recruiter.md, Admin chapter points to it
- Share action shown to anyone with canWriteCandidates, not tied to the opening being open
- E2E → one Playwright spec, run only on own ports + throwaway DB; branch from origin/develop
## Out of scope
- "Shared with me" view for grantees (#186), auto-share when booking (#187), any backend change beyond what CLARIFY approves.
## Follow-ups
- Multi-select popover stays open after a pick and covers the form; spec clicks the heading to close it.
- The options endpoint lists every active user to a Recruiter (same set assignable-users already gives any role).
- E2E share spec leaves one revoked grant per run (soft revoke, no delete API).
