# GET /api/status-options/next/{candidateId} is unscoped and confirms a candidate exists
- Source: issue #100 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/100
- Type: bug

## Request
- `StatusOptionsController.GetNext` has only the class-level `[Authorize]` (any role), and
  `StatusOptionService.GetNextForCandidateAsync` queries `Candidates` with no owner/role scope.
- A Recruiter out of scope for a candidate gets 200 (not 404 like `GET /api/candidates/{id}`).
  An Interviewer gets 200 (not 403). Both leak that the candidate exists and narrow down its
  current status via the allowed-transitions list, with no candidate data returned.
- Fix: gate `GetNext` on `Roles.CanWriteCandidate` and resolve the candidate through the same
  access scope `CandidatesController`/`CandidateService` already use elsewhere.

## Decisions
- Scope via a new `CandidateService.GetCurrentStatusIfAccessibleAsync(id, ownerUserId)` reusing
  the existing private `ApplyAccess` predicate, rather than duplicating the scoping logic in
  `StatusOptionService`. `StatusOptionService` takes a `CandidateService` dependency.
- `GetActive` and `GetInitial` are untouched — out of scope per the issue, and not candidate-
  scoped by nature (lookup lists, not candidate-specific).

## Out of scope
- `GetActive` / `GetInitial` authorization (unchanged, issue doesn't ask for it).
- The other four HIGH findings from the same access-control review (fixed separately per the
  issue body).

## Follow-ups
(none yet)
