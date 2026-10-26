# Backend cleanups: unscoped rubric-for-interview endpoint, expired openings on create, cheaper scope checks
- Source: issue #201 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/201
- Type: improvement (label "Improvements") -> feature/ branch
## Request (six independent items)
- 1 EvaluationRubricsController.CurrentUserId is always 0 (reads NameIdentifier; id is in sub): use injected CurrentUser.
- 2 GET /api/evaluation-rubrics/for-interview/{id} is unscoped: any user can probe any interview id.
- 3 CandidateService create/update check only IsActive, not EndDate, so a candidate can be filed into an expired opening.
- 4 Update skips the duplicate-email check that create performs.
- 5 CandidatesController loads the full detail graph (GetByIdAsync) only for a scope check (:132,:149,:249); GetCurrentStatusIfAccessibleAsync is cheaper.
- 6 NotificationService.MarkAllReadAsync -> one ExecuteUpdateAsync; OfferService.GetMetricsAsync four counts -> one GroupBy.
## Decisions
- 1 use injected CurrentUser; 2 rubric-for-interview scoped (Admin+, assigned interviewer, in-scope Recruiter, EvaluationAccess grantee; else 404), controller only
- 3 create refuses an ended/inactive opening (400); update only when the opening changes to one
- 4 update refuses a changed email another candidate uses (409, no details) unless optional AllowDuplicate
- 5 scope checks via GetCurrentStatusIfAccessibleAsync; 6 MarkAllRead ExecuteUpdate, metrics one aggregate
- all -> go with recommendation
## Out of scope
- Rubric resolution logic (RG-188, PR #215).
## Follow-ups
