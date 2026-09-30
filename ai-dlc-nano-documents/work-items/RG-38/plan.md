<!-- phase: DONE | branch: fix/RG-38/User-name-validation | tasks: 9/9
 base: d7dced9 | updated: 2026-09-30
     next: none - PR #79 open against develop -->
# Plan: Reject emoji and symbol-only person names
Rule (one shared definition, enforced client and server):
required (unchanged) - trimmed length <= 100 - must contain at least one
Unicode letter `\p{L}` - must contain no `\p{C}` (control/format/surrogate) and
no `\p{S}` (symbols, which is where emoji and pictographs live). Digits and
ordinary punctuation stay legal, so "Anne-Marie O'Neill" and Bangla/CJK names
pass; "emoji emoji" and "###" do not.
## Tasks
- [x] `Services/PersonNameValidator.cs` (new): `Validate(name, label) -> string?`
- [x] `UserService.CreateAsync` + `UpdateAsync`: swap the IsNullOrWhiteSpace check
- [x] `CandidateService.ValidateCandidateAsync` (fullName) + `ValidateReference` (referenceName)
- [x] `CandidateDraftService.ApproveDraftAsync`: same check on the promoted fullName
- [x] `client/src/utils/personName.ts` (new): `validatePersonName(value, label)`
- [x] `UsersPage.submitForm`, `CandidateForm.handleSubmit`, `DraftReviewWorkspace` line ~358
- [x] `PersonNameValidatorTests.cs` (new - no UserService/validator tests exist today)
- [x] `client/src/utils/personName.test.ts` (new)
- [x] Update `ai-docs/conventions.md` with the shared name rule
## Tests
Standard tier. Unit tests both sides over the same table: emoji, ZWJ sequence,
flag, skin-tone modifier, control char, symbols-only, digits-only, 101 chars,
empty/whitespace, and the legitimate set (accents, apostrophe, hyphen, Bangla,
CJK, single letter). Full `dotnet test` + `npm test` + `tsc -b` + oxlint, then
save an emoji name in the real Edit-user modal and confirm it is refused.
## Files
- server: Services/{PersonNameValidator,UserService,CandidateService,CandidateDraftService}.cs
- client: utils/personName.ts, pages/UsersPage.tsx, components/CandidateForm.tsx,
  components/drafts/DraftReviewWorkspace.tsx
- tests: Tests/PersonNameValidatorTests.cs, client/src/utils/personName.test.ts
## Risk noted
`ApproveDraftAsync` also runs under bulk approve, where the name comes from the
CV parser. The rule allows letters, digits and punctuation, so parsed names
should pass; if a bulk approve starts failing, that is the first place to look.
