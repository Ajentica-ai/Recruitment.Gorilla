# Per-job-opening evaluation rubrics never apply: lookup uses the always-null Candidate.AppliedRole
- Source: issue #188 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/188 (related: #165 string match breaks on rename, #191 client/server fallbacks)
- Type: bug
## Request
- EvaluationRubricService.GetForInterviewAsync and InterviewService.UpsertEvaluationAsync look the rubric up by Candidate.AppliedRole == RoleAppliedOption.Name, but the client sends appliedRole null, UpdateAsync overwrites it with null, draft approval and JSON import never set it. So every UI-created candidate gets the default rubric.
- Same root cause: interview assigned/moved/cancelled emails and invites pass candidate.AppliedRole as the role name, so the role line is blank (CandidateService :744/:756, InterviewService :530/:611).
- Fix: one shared resolver (via Candidate.RoleAppliedOptionId -> EvaluationRubric) used by the rubric endpoint and evaluation validation; role name = RoleAppliedOption?.Name ?? AppliedRole in notifications/invites.
- Tests: a candidate under an opening with a custom rubric gets it from for-interview/{id} and can submit against its keys; interview emails carry the opening name.
## Decisions
- Candidates with only the legacy AppliedRole → resolver uses RoleAppliedOptionId first, falls back to the old name match only when it is null (user: go with recommendation)
- One rule for both paths → opening's rubric if active AND has criteria, else default active, else any active; endpoint and validation share it (the empty-criteria edge case now uses the default in both)
- UpdateAsync nulling the legacy AppliedRole stays as is; noted in the backlog
- Branch → fix/RG-188/Rubric-lookup-by-job-opening from origin/develop
## Out of scope
- #191 (client/server fallback differences, draft unsavable) and #165 (weighted rubric).
## Follow-ups
