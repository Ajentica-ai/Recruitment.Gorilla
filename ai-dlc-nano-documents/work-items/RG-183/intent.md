# Evaluation sharing 1/5: access grant model and share/revoke API (backend)
- Source: issue #183 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/183, phase 1 of epic #182 (phases #183-#187; PRs say "Part of #182", never "Closes #182")
- Type: feature (enhancement)
## Request
- New EvaluationAccessGrant entity + migration, and EvaluationSharesController (GET/POST/DELETE) under api/candidates/{candidateId}/evaluation-shares.
- Nothing reads grants yet (phase 2). No UI (phase 3).
## Decisions
- Phase 1 only, own branch and PR; each later phase is a separate item (user confirmed).
- Rules from #182: only submitted evaluations are ever shared; 404 for out-of-scope; soft revoke; optional expiry; audited; grantees cannot re-share.
## Out of scope
- Grantee read endpoints (#184), UI (#185, #186), panel auto-share (#187); the Notification link (phase 4).
## Follow-ups
