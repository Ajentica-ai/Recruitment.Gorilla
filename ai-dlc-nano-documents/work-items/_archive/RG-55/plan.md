<!-- phase: DONE | branch: fix/RG-55/Delete-discarded-drafts | tasks: 6/6
     base: 1232a27 | updated: 2026-10-13
     next: none -->
# Plan: permanently delete Discarded CV drafts (HIGH blast radius: deletion path, file removal, auth scope)
## Tasks
- [x] Service: DeleteDraftAsync / BulkDeleteAsync: only Status=Discarded within ScopedDrafts; remove the row, then the stored file only if no CVFile or other draft references it (best-effort, contained via UploadPaths)
- [x] Controller: DELETE api/candidate-drafts/{id} (400 if not Discarded, 404 if missing/out of scope) and POST bulk-delete {draftIds} returning deletedCount; log like discard
- [x] Client: api.ts deleteCandidateDraft + bulkDeleteCandidateDrafts; Discarded tab gets Delete Draft (footer) and Delete Selected (bulk bar), each behind a ConfirmModal saying it is permanent
- [x] Backend tests: deletes only Discarded, Pending/Approved untouched, file kept when attached to a candidate, recruiter scope, 404/400, [Authorize] gate (Interviewer 403)
- [x] Frontend test for the Discarded-tab delete flow; full dotnet test + npm test + tsc + lint
- [x] Browser check (user, single delete verified); ai-docs updated (backend, frontend)
## Tests
- High blast radius: failure and scope paths tested, full suites, real browser check
## Files
- server: Services/CandidateDraftService.cs, Controllers/CandidateDraftsController.cs, Tests
- client: services/api.ts, components/drafts/DraftReviewWorkspace.tsx (+test), ai-docs