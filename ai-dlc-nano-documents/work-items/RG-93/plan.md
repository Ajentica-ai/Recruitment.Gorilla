<!-- phase: WRAP-UP | branch: feature/RG-93/Block-duplicate-cv-upload | tasks: 10/10
     base: 107fd68 | updated: 2026-10-02
     next: push branch + open PR against develop (both gated) -->
# Plan: Block re-uploading the same CV
Note: tasks 1-7 were written before this workflow started (uncommitted, on feature/block-duplicate-cv-upload).
## Tasks
- [x] 1. `FileHash` (varchar 64, indexed) on CVFile + CandidateDraft; AppDbContext config
- [x] 2. Migration `20261002120000_AddCvFileHash` (hand-written; ef tooling needs a live DB)
- [x] 3. `CandidateDraftService.ComputeFileHash` + `FindDuplicateUploadAsync` (incl. legacy backfill)
- [x] 4. CVUploadController: hash, check, 409 + SignalR error before save/parse; draft stores hash
- [x] 5. Hash copied to CVFile on approval and on direct create (CandidateService)
- [x] 6. BulkUploader: 409 -> Duplicate badge + "Skipped N duplicate CVs" alert
- [x] 7. ai-docs: data-model, backend, frontend
- [x] 8. Apply migration locally (`dotnet ef database update`) and run full `dotnet test`
- [x] 9. End-to-end: upload a CV, upload it again (and renamed) -> 409; discard -> re-upload OK
- [x] 10. Commit referencing #93 (branch renamed, approved)
## Tests
- Tier: high blast radius (migration). Additive nullable columns; Down drops indexes + columns.
- Service: Pending blocks, Discarded allows, candidate-attached blocks, legacy file hashed + backfilled.
- Vitest: 409 shown as duplicate, not parse failure. Snapshot-vs-model checked with EF differ (done).
- Status: 250/250 xUnit, tsc + 120 Vitest green; migration applied to dev DB, no pending model changes; e2e 409s verified.
## Files
- server/.../Models/{CVFile,CandidateDraft}.cs, Data/AppDbContext.cs, Migrations/*AddCvFileHash*, snapshot
- server/.../Services/{CandidateDraftService,CandidateService}.cs, Controllers/CVUploadController.cs
- server/Recruitment.Gorilla.Tests/{CandidateDraftServiceTests.cs,Infrastructure/DbTestBase.cs}
- client/src/components/BulkUploader{,.test}.tsx, ai-docs/{data-model,backend,frontend}.md
