# Emoji characters can be entered in the user Name field
- Source: issue #38 https://github.com/tahmidsparrow/Recruitment.Gorilla/issues/38
- Type: bug (labelled Improvements / UI)
## Request
- The Add/Edit user modal on `UsersPage` accepts any text as a Name. The
  screenshot shows a user saved with the name `emoji emoji emoji emoji`.
- Nothing rejects it client side (`submitForm` only checks `!name.trim()`) and
  nothing rejects it server side (`UserService.CreateAsync`/`UpdateAsync` only
  check `IsNullOrWhiteSpace`).
- The stored name then feeds the user list, avatars/initials, audit entries and
  the account-created / password-reset emails.
## Decisions
- Issue type for the branch prefix? -> Bug: `fix/RG-38/User-name-validation`.
- Which rule? -> Block emoji, pictographs, control chars and symbol-only input;
  allow every Unicode letter so non-Latin names still pass; require at least one
  letter; cap at 100 characters.
- Enforce where? -> Client and server. Client alone leaves the API bypassable.
- How wide? -> User name AND candidate name (user chose the wider scope), which
  pulls in the reference name and the draft-approve promote path.
## Out of scope
- Job titles, company names and other free-text fields.
- Backfilling or cleaning names already stored with emoji.
## Follow-ups
- RESOLVED during WRAP-UP: the user supplied the working local MySQL credential,
  so the full 246-test backend suite ran green and the API started. The
  user-secrets copy of the credential is still stale and worth refreshing.
- RESOLVED during WRAP-UP: the Users page is SuperAdmin-only and no reachable
  Super Admin existed (the seeded admin@recruitmentgorilla.com is *named*
  "Super Admin" but holds the Admin role). Seeded demo.superadmin@rg.local via
  Auth__SeedAdminEmail at the user's request, then confirmed over real HTTP that
  both POST /api/users and PUT /api/users/{id} reject emoji names.
- The account is recorded in the gitignored client/e2e/.env.e2e, with a
  placeholder and seeding instructions in the tracked .env.e2e.example.
- Prism `<Label>` is not tied to its `<Input>` with `htmlFor`, so
  `getByLabelText` cannot find a field and screen readers lose the association.
  Found while writing the CandidateForm test, which had to select by position.
- `CandidateService` stores `dto.FullName` untrimmed while `UserService` trims,
  so a padded candidate name validates on the trimmed value but saves padded.
- `CandidateDraftService.UpdateDraftAsync` still accepts any draft name. Left
  deliberately: drafts hold raw CV-parser output, and the approve path now
  rejects a bad name before it can become a candidate.
- Names already stored with emoji are not backfilled or cleaned.
