# Add Education form shows predefined values instead of blank fields
- Source: issue #58 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/58
- Type: bug
## Request
- In the draft review workspace (Upload CVs -> Pending -> open a draft), clicking "+ Add Education"
  under Education & Academic Qualifications inserts a row pre-filled with sample values
  (degree "BSc in CSE", institution "University", graduationYear "2024") instead of a blank row.
- Root cause: `DraftReviewWorkspace.tsx` hardcodes that object literal as the new entry instead of
  empty strings. Each field already has a descriptive placeholder, so the preset values are both
  wrong and redundant.
## Decisions
- Fix both Education and the identical sibling bug on "+ Add Experience" (user, 2026-10-10)
- No new test; verify by reproducing in the running app before/after (user, 2026-10-10)
## Out of scope
- Adding test coverage for DraftReviewWorkspace in general.
## Follow-ups
