<!-- phase: DONE | branch: fix/RG-100/Scope-status-options-next | tasks: 5/5
     base: 42c2b46 | updated: 2026-10-09
     next: none — commit/push/PR not yet requested -->
# Plan: Scope GET /api/status-options/next/{candidateId}
## Tasks
- [x] Add `Get_next_status_options` theory to `ControllerAuthorizationTests.cs`, confirmed it fails against the unfixed code first (Recruiter/Interviewer both got OK instead of NotFound/Forbidden)
- [x] Add `CandidateService.GetCurrentStatusIfAccessibleAsync(id, ownerUserId)` (reuses `ApplyAccess`)
- [x] `StatusOptionService`: inject `CandidateService`; `GetNextForCandidateAsync` takes `ownerUserId`, uses the new method instead of a raw `db.Candidates` query
- [x] `StatusOptionsController.GetNext`: inject `CurrentUser`, add `[Authorize(Roles = Roles.CanWriteCandidate)]`, compute owner scope (Admin+ => null, else `currentUser.UserId`) same as `CandidatesController.ReadOwnerScope`
- [x] `dotnet build` + `dotnet test` (full suite) — 505/505 passed
## Tests
- Standard tier. New integration theory reproduces both reported leaks (Recruiter 200→404,
  Interviewer 200→403) before the fix, passes after.
## Files
- server/Recruitment.Gorilla.API/Controllers/StatusOptionsController.cs
- server/Recruitment.Gorilla.API/Services/StatusOptionService.cs
- server/Recruitment.Gorilla.API/Services/CandidateService.cs
- server/Recruitment.Gorilla.Tests/ControllerAuthorizationTests.cs
