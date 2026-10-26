<!-- phase: WRAP-UP | branch: fix/RG-188/Rubric-lookup-by-job-opening | tasks: 7/7
     base: e9d40c4 | updated: 2026-10-21
     next: user yes to push + PR (Closes #188)
# Plan: RG-188 per-opening rubrics apply (bug, standard rigor)
## Tasks
- [x] Repro first: failing tests with a candidate that has only RoleAppliedOptionId (AppliedRole null) under an opening with a custom rubric: for-interview/{id} returns the default today, and a submit against the custom keys is rejected
- [x] EvaluationRubricService.ResolveForInterviewAsync(interviewId): opening link first (RoleAppliedOptionId), legacy AppliedRole name match only when null; rubric must be active AND have criteria, else default active, else any active; returns the entity with criteria
- [x] GetForInterviewAsync maps that result; InterviewService.UpsertEvaluationAsync takes valid keys from the same resolver (built-in key catalog only when no rubric exists)
- [x] Role name for interview emails/invites/notifications = RoleAppliedOption?.Name ?? AppliedRole: CandidateService booking (load the opening name), InterviewService Reschedule and Cancel (CandidateDetailDto.RoleApplied)
- [x] Tests: custom rubric via endpoint and submit, default rejects custom keys, rename of the opening keeps working, legacy-only candidate still works, inactive/empty rubric falls back, emails/notifications carry the opening name, one HTTP test via the API fixture
- [x] Docs: ai-docs (backend.md rubric resolution; data-model note), backlog entry for UpdateAsync nulling AppliedRole
- [x] dotnet test full, isolated real-API check of for-interview + submit on a throwaway DB, notes/backlog
## Tests
- Bug: failing repro tests first, kept as regression. Rigor: standard (no migration, no auth change).
## Files
- Services/EvaluationRubricService.cs, Services/InterviewService.cs, Services/CandidateService.cs, tests (EvaluationRubricServiceTests, ApiTests), ai-docs/backend.md, data-model.md
