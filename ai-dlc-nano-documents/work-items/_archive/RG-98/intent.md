# Candidate create 409 leaks an out-of-scope candidate's full record
- Source: issue #98 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/98
- Type: bug (label: bug)

## Request
- `CandidateService.CreateAsync` -> `FindDuplicateAsync(dto.Email)` matches by email
  with no access scope, and `CandidatesController.Create` returns that candidate's
  full record (name, phone, title, role, status...) in the 409 body, even when the
  caller (e.g. a Recruiter) has no access to that candidate. Repeatable, silent
  (nothing written on the 409 path) -> an email-based lookup oracle.
- Expected (per issue): keep the global duplicate *check*, but only include the
  record in the response when the caller may access that candidate (same
  `ApplyAccess` predicate used elsewhere in `CandidateService`); otherwise a 409
  with a generic message and no candidate data.
- Issue asks for tests: out-of-scope Recruiter gets no candidate data; in-scope
  Recruiter and Admin get the record.

## Comment on the issue (tahmidsparrow)
> The candidate can't be identified as same only based on email, as there could be
> same email if the candidate comes from a 3rd party company, a vendor, or a
> recruitment agency.
This questions the email-only duplicate-matching heuristic itself, not just the
disclosure. Needs a decision on scope before planning (see Decisions).

## Decisions
- Investigated the matching method: no DB unique constraint on Candidate.Email,
  match is bare `Email == dto.Email` equality, and the 409 is a non-blocking
  "warn but allow" (frontend has a "Save anyway" that resubmits with
  `allowDuplicate: true` and always creates). So a shared vendor/agency email
  already costs the recruiter only an extra click, never a block.
- Decision: fix the disclosure only. Leave the email-equality match exactly as
  it is today; do not add name/phone as a second signal. -> user confirmed.
- Still return 409 when a duplicate exists but is out of the caller's scope
  (keeps the global "heads up, this might be a dup" signal) - just omit the
  candidate record and use a generic message instead of the real one.

## Out of scope
- Changing the duplicate-matching heuristic itself (tracked as a possible
  future issue, not this one).
- CandidateImportService's duplicate warning (CandidateImportController is
  Admin-only, so ApplyAccess already grants it unrestricted visibility - no
  leak there).

## Follow-ups
- Found during CONSTRUCT: `POST /api/candidates` (the endpoint this fix scopes) is not
  wired into the live UI at all - `CandidateForm.tsx`/`createCandidate()` has zero
  importers; the real create flow is `CandidateDraftService.ApproveDraftAsync` via
  `/candidate-drafts/{id}/approve`, which builds the `Candidate` directly with **no**
  duplicate-email check of any kind (so nothing there to disclose, but also no warning
  for the vendor/agency-collision scenario raised in the original comment). The fix
  here still closes a real, directly-callable API vulnerability, but has no visible
  effect through today's UI. Surfaced to the user; not fixed here (separate, larger
  decision about the draft-approval flow).
