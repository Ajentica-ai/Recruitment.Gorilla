<!-- phase: WRAP-UP | branch: feature/RG-183/Evaluation-share-grants-api | tasks: 8/8
     base: 024c6e0 | updated: 2026-10-19
     next: user approves push + PR (Closes #183, Part of #182) -->
# Plan: RG-183 evaluation share grants API (HIGH blast radius: migration + permissions)
## Tasks
- [x] Tests first: service unit + integration authorization matrix
- [x] Model EvaluationAccessGrant, AppDbContext config, migration AddEvaluationAccessGrants
- [x] DTOs + EvaluationShareService (list/create/revoke, skip full-access grantees, dedupe-update)
- [x] EvaluationSharesController (CanWriteCandidate, candidate scope, 404 rules)
- [x] Audit + NotificationCategories.EvaluationShared notification (no link)
- [x] Docs: data-model.md, auth.md matrix row, backend.md
- [x] dotnet test full + real API on a throwaway DB (isolated ports) + security review
- [x] backlog/notes
## Tests
- High blast radius: failure paths and edge cases, not only happy path
## Files
- Models/EvaluationAccessGrant.cs, Data/AppDbContext.cs, Migrations/*, DTOs, Services/EvaluationShareService.cs, Controllers/EvaluationSharesController.cs, tests, ai-docs
