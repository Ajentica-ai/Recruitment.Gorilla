<!-- phase: DONE | branch: fix/RG-97/Enforce-role-assignment | tasks: 6/6
     base: fd183e9 | updated: 2026-10-09
     next: none — commit/push/PR not yet requested -->
# Plan: Enforce role assignment on candidate create/update
## Tasks
- [x] Reproduce: confirmed by direct code inspection (unguarded `dto.RoleAppliedOptionId` writes
  at the exact lines named in intent.md) — a true pre-fix test run was impractical since the new
  tuple return shapes don't exist on the old signatures; see plan note below
- [x] `CandidateService.cs`: added `IsAssignedToRoleAsync`; wired into `CreateAsync` (3-tuple,
  new `scopeUserId` param — NOT the existing `ownerUserId`, which is always set) and
  `UpdateAsync` (2-tuple, only-if-changed guard)
- [x] `CandidatesController.cs`: `Create`/`Update` destructure new tuples, `BadRequest(roleError)`
- [x] `CandidateServiceAccessTests.cs`: 6 new cases, all passing (17 total in file)
- [x] New `CandidateRoleAssignmentApiTests.cs`: 4 HTTP-level cases, all passing
- [x] `ai-docs/auth.md` updated; full `dotnet build` + `dotnet test` — 515/515 passed
## Bug found during CONSTRUCT (self-caught, fixed same session)
`CreateAsync`'s existing `ownerUserId` param is always `currentUser.UserId` (sets who owns the
new candidate), unlike `UpdateAsync`'s `ownerUserId` (scope filter, null for Admin+). My first
pass wired the assignment check off the wrong one, so it fired for Admin too. Fixed by adding a
separate `scopeUserId` param (passed as `WriteOwnerScope`) just for the check. Caught by the new
`An_admin_can_create_a_candidate_for_any_role` test failing; a second instance of the identical
mistake then appeared in the unit tests themselves (calling the old 3-arg overload, so the
check silently no-opped) — caught by `Recruiter_cannot_create_a_candidate_under_an_unassigned_role`
failing after the controller fix. Both are fixed; full suite green.
## Tests
High-blast-radius tier (auth/permissions): full suite + failure path + edge cases, per plan file.
## Files
- server/Recruitment.Gorilla.API/Services/CandidateService.cs
- server/Recruitment.Gorilla.API/Controllers/CandidatesController.cs
- server/Recruitment.Gorilla.Tests/CandidateServiceAccessTests.cs
- server/Recruitment.Gorilla.Tests/CandidateRoleAssignmentApiTests.cs (new)
- ai-docs/auth.md
