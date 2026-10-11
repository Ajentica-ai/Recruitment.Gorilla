# Server does not enforce role assignment when a Recruiter creates/edits/approves a candidate
- Source: issue #97 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/97
- Type: bug

## Request
- `CandidateService.CreateAsync`/`UpdateAsync` write `dto.RoleAppliedOptionId` unchecked; a
  Recruiter can file/reassign a candidate under a role they aren't an assigned recruiter for.
  Only the client (dropdown contents) enforces this today.
- Relevance check: 3 of the 4 originally-named spots (draft approve/update/bulk-approve) are
  already fixed by RG-130 (PR #131, merged) via `CandidateDraftService.ValidateJobOpeningForCallerAsync`.
  Only `CandidateService.CreateAsync`/`UpdateAsync` remain open.

## Decisions
- Check lives inside `CreateAsync`/`UpdateAsync` (using the `ownerUserId` they already take),
  not a separate controller-level method — matches how `CandidateService` already scopes
  internally (`ApplyAccess`, `DeleteAsync`'s owner check).
- `CreateAsync` gains an `Error` tuple leg; `UpdateAsync` returns `(Updated, Error)` — matches
  `CandidateDraftService`'s existing convention.
- `UpdateAsync` only re-checks when `RoleAppliedOptionId` actually changes (mirrors
  `UpdateDraftAsync`'s identical guard) — a Recruiter editing other fields on a candidate under
  a role they aren't assigned to (legitimate, creator-agnostic access) isn't blocked.
- `ValidateCandidateAsync` untouched; `CandidateDraftService` untouched (already fixed).
- Error message: "You are not assigned to this job opening." (matches existing wording).
- Design validated by a second planning pass before user approval; no open questions.

## Out of scope
- `CandidateDraftService` (RG-130 already covers it).
- Extracting the `Recruiters.Any(rr => rr.UserId == uid)` predicate (already duplicated ~9x).

## Follow-ups
(none yet)
