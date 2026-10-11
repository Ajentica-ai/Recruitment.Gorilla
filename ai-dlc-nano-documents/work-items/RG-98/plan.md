<!-- phase: DONE | branch: fix/RG-98/Candidate-duplicate-scope-leak | tasks: 10/10
     base: 4c298c1 | updated: 2026-10-11
     next: none - verified (533/533 backend, 221/221 frontend), ready to commit -->
# Plan: Scope the candidate-create 409 duplicate record to the caller's access

Rigor tier: **high blast radius** (access-control/PII fix) - full suite +
edge cases below, matching the issue's own suggested tests.

## Tasks
- [x] `CandidateService.FindDuplicateAsync(email, accessUserId)`: scope the
      returned record with the same owner/assigned-role predicate as `ApplyAccess`;
      return `(CandidateListItemDto? Visible, bool Exists)`.
- [x] `CandidateService.CreateAsync`: pass `scopeUserId` into the scoped lookup;
      grow the return tuple to `(Created, Duplicate, DuplicateExists, Error)`.
- [x] `CandidateImportService.cs:185`: adapt to the new tuple (Admin-only
      caller, unrestricted scope - no behavior change there).
- [x] `DuplicateCandidateDto.Existing` -> nullable.
- [x] `CandidatesController.Create`: branch on `DuplicateExists`; generic
      message + null `Existing` when hidden, real message + record otherwise.
- [x] Update the 3 existing `CandidateServiceAccessTests.cs` call sites for the
      new 4-tuple shape.
- [x] Add service tests: out-of-scope Recruiter -> hidden; owning/assigned
      Recruiter -> visible; Admin -> visible.
- [x] `ApiFixture.NewCandidateAsync`: add optional `email` param (default
      random, like `roleId` already does) so a test can force a collision.
- [x] New `CandidateDuplicateDisclosureApiTests.cs`: POST with a colliding
      email as an out-of-scope Recruiter -> 409 body has no name/id/phone; as
      an in-scope caller/Admin -> 409 body has the record.
- [x] Frontend: `DuplicateCandidate.existing` -> nullable; `CandidateForm.tsx`
      hides "Open existing candidate" when null (message + "Save anyway" only).

## Tests
- `dotnet test` (full suite, local MySQL) - the new/updated
  `CandidateServiceAccessTests` and `CandidateDuplicateDisclosureApiTests`.
- `npx tsc -b`, `npm test`, `npm run lint`.
- Manual: log in as the seeded Recruiter, trigger a real duplicate they own ->
  confirm link + details still show (regression check on the visible path).

## Files
- server/Recruitment.Gorilla.API/Services/CandidateService.cs
- server/Recruitment.Gorilla.API/Services/CandidateImportService.cs
- server/Recruitment.Gorilla.API/DTOs/CandidateDtos.cs
- server/Recruitment.Gorilla.API/Controllers/CandidatesController.cs
- server/Recruitment.Gorilla.Tests/CandidateServiceAccessTests.cs
- server/Recruitment.Gorilla.Tests/CandidateDuplicateDisclosureApiTests.cs (new)
- server/Recruitment.Gorilla.Tests/Infrastructure/ApiFixture.cs
- client/src/types/index.ts
- client/src/components/CandidateForm.tsx
