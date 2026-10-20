<!-- phase: DONE | branch: feature/RG-184/Shared-evaluations-read-api | tasks: 8/8
     base: ac3ec05 | updated: 2026-10-20
     next: user decides the 2 review questions, then commit, push, PR
# Plan: RG-184 grantee read endpoints + one access predicate (HIGH blast radius: permissions)
## Tasks
- [x] Tests first: predicate truth table (no grant, revoked, expired, candidate-wide, interview-specific, inactive grantee, unsubmitted vs submitted panelist) + HTTP matrix
- [x] EvaluationAccess service: one predicate (active grant AND NOT unsubmitted panelist on that interview), registered in Program.cs
- [x] Refactor GetCandidateEvaluationReportAsync to take an optional interview-id filter (existing callers unchanged)
- [x] SharedEvaluationsController + DTOs: GET mine, GET candidates/{id}, GET candidates/{id}/profile (StatusHistory empty), GET candidates/{id}/cv/{fileId}; 404 when nothing visible
- [x] Submit fan-out to grantees covering the interview (not submitter, active, passes predicate), link /shared/{candidateId}
- [x] #183 follow-up: re-grant without expiry keeps existing expiry/note (+ test); duplicates tolerated by reads
- [x] Docs: auth.md row "View shared evaluations" + predicate/peer-rule paragraph; backend.md; data-model if touched
- [x] Full dotnet test + real API on isolated ports/throwaway DB + security review; notes/backlog
## Tests
- High blast radius: failure paths, revoked/expired take effect immediately, drafts never shown, aggregates exclude interviews outside the grant, no status history, existing endpoints unchanged (regression), grantee fan-out.
## Files
- Services/EvaluationAccess.cs, InterviewService.cs, EvaluationShareService.cs, Controllers/SharedEvaluationsController.cs, DTOs, Program.cs, tests, ai-docs
