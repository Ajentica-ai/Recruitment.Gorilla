# Evaluation sharing 2/5: grantee read endpoints and one access predicate
- Source: issue #184 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/184 (Part of #182, phase 2 of 5)
- Type: feature
## Request
- Backend only. A grantee reads what was shared with them through new endpoints open to any authenticated role.
- One access predicate used by every read path; keeps the same-interview peer rule (own evaluation unsubmitted = no peer verdicts).
- New SharedEvaluationsController, route api/shared-evaluations: GET /mine, GET /candidates/{id}, GET /candidates/{id}/profile (+ CV streaming).
- Report logic refactored to take an optional interview-id filter; existing endpoints are not widened.
- Submit fan-out also notifies active grantees covering that interview.
## Decisions
- Branch base → from origin/develop (#183 / PR #206 already merged) (user confirmed)
- #183 follow-ups in this PR → read path tolerates duplicate grants (no new migration, unique index stays in backlog); re-grant without expiry keeps existing expiry and note (user: go with recommendation)
- Notification link → /shared/{candidateId}, dead until #186 ships; do NOT build any #186 UI here (user confirmed)
- Grantee's own submitted evaluation → included in the shared report (user: go with recommendation)
- Deactivated grantee → no access, in predicate and fan-out (user: go with recommendation)
- CV streaming at GET api/shared-evaluations/candidates/{id}/cv/{fileId}, same grant check; grant answers only from the grant, existing role access untouched (assumed, not objected to)
## Out of scope
- Any UI or frontend route, incl. #186 "Shared with me" view (user explicit). Unique index for duplicate grants.
- UI (phases 3 to 5). Widening GET api/candidates/{id}/evaluation-report or GET api/interviews/{id}.
## Follow-ups
- Security review (no High): candidate-wide grant shows other rounds to someone still due on a later round (kept as the issue defines it, user: go with recommendation); cancelled interviews are now excluded (user: go with recommendation).
- From RG-183 backlog: duplicate-grant race, inactive grantees on the read path, grantor scope check kept separate from grants.
