# Spec: JSON Candidate Import

**Status:** Implemented
**Author:** tahmidsparrow
**Date:** 2026-10-07

## 1. Summary
A Super Admin can import one or more candidates from a JSON file, each paired with its CV. Every valid entry becomes a Pending `CandidateDraft`, prefilled from the JSON, and goes through the existing Review Workspace like a parsed CV.

## 2. Motivation
The CV parser is heuristic and often misses fields. Candidate data frequently already exists in structured form (an ATS export, a spreadsheet, or an AI assistant's extraction), so typing it again in review is wasted effort. Importing it as key/value pairs gives exact drafts while keeping the human approval step.

## 3. Scope
**In scope:**
- A downloadable template (`candidate-import-template.json`) whose comments explain the format: mandatory fields, optional fields, allowed role and source names, and rules for an AI assistant filling it in.
- An importer that accepts JSON with comments and trailing commas, in three shapes: `{ "candidates": [...] }`, a bare list, or one candidate object.
- A CV is required for every entry, matched by the entry's `cvFileName` (case-insensitive).
- A client-side pre-check table, then one request per entry.
- Super Admin only, on both the API and the UI.

**Out of scope / later:**
- Entries without a CV (would need nullable file columns on `CandidateDraft`).
- Creating candidates directly without review.
- Skill-option matching: skills stay free text, as for parsed CVs.

## 4. Data model changes
None. Drafts already hold every field the template covers.

## 5. API contract
| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/candidate-import/template` | **SuperAdmin** | - | `application/json` attachment `candidate-import-template.json` | Generated per request: lists open job openings (active, `EndDate` not passed) and active sources in its comments. |
| POST | `/api/candidate-import` | **SuperAdmin** | multipart: `entry` (one candidate as JSON text, comments allowed), `file` (the CV), optional `batchId`, `batchName`, `fileIndex`, `totalFiles`, `roleAppliedOptionId` | `200 { draft: CVDraftDto, warnings: string[] }` | `400` unreadable entry, bad file type/size, `cvFileName` not equal to the file's name, or validation errors (joined into one message). `409` the same CV content is already in a Pending draft or on a candidate. |

Template keys (case-insensitive): `cvFileName`\*, `fullName`\*, `email`\*, `phone`, `currentTitle`, `relevantExperience`, `location`, `role`, `source`, `sourceDetail`, `skills` (string or list), `summary`, `linkedInUrl`, `githubUrl`, `gitLabUrl`, `portfolioUrl`, `leetCodeUrl`, `codeforcesUrl`, `hackerRankUrl`, `educations[] { degree*, institution*, graduationYear, cgpa }`, `experiences[] { jobTitle*, company*, duration, description }`. Numbers are accepted where text is expected (`"cgpa": 3.7`).

## 6. Backend design
- `CandidateImportController` (`[Authorize(Roles = Roles.SuperAdmin)]`). It is its own controller so it does not inherit `CVUploadController`'s `CanWriteCandidate`.
- `CvFileIntake` holds the CV checks both upload paths share: `.pdf`/`.docx`, at most 10 MB, SHA-256 duplicate check (`CandidateDraftService.FindDuplicateUploadAsync`), and saving as `Uploads/{Guid}{ext}`. `CVUploadController` uses it too.
- `CandidateImportService`:
  - `ParseEntry`: `System.Text.Json` with `JsonCommentHandling.Skip`, trailing commas, case-insensitive names and `LenientStringConverter`. It trims values, turns blanks into null, and drops education/experience rows that are entirely empty (the template ships one of each).
  - `ValidateAsync`:
    - **Errors:** missing `cvFileName`/`fullName`/`email`; name fails `PersonNameValidator`; email fails `EmailFormat`; a value is longer than its column; an incomplete education or experience row.
    - **Warnings:** an unknown, inactive or closed role, or an unknown or inactive source (the field is left blank for the reviewer); an email already on a candidate or a Pending draft; unknown keys. A role or source name is matched case-insensitively, preferring an open match. The batch's job opening applies only when the entry names no role.
  - `CreateDraftAsync`: builds the draft and saves it through `CandidateDraftService.AddDraftAsync` (Pending, owned by the caller), then audits `CandidateDraft.ImportedFromJson`. The CV is not parsed.
  - `BuildTemplateAsync`: fills the embedded `Resources/candidate-import-template.jsonc` (logical name `CandidateImportTemplate`). The experience presets must match `EXPERIENCE_PRESETS` in `DraftReviewWorkspace.tsx`.
- If draft creation throws after the CV was saved, the controller deletes the file.

## 7. Frontend design
- `utils/importManifest.ts`:
  - `stripJsonComments`: string-aware, so a URL containing `//` survives.
  - `parseImportManifest(text, files)`: produces rows with errors and warnings (missing keys, no matching CV, one CV used twice, repeated email, wrong type or size, unknown keys) plus the dropped CVs no entry names.
- `api.ts`: `downloadImportTemplate()` (blob download, via the shared `saveBlob` also used by `downloadCvFile`) and `importJsonCandidate(entry, file, ...)`.
- `components/JsonImporter.tsx`:
  - a template download button and the same Batch Label and Job Opening inputs as `BulkUploader`;
  - one dropzone for `.json`, `.pdf` and `.docx`;
  - a pre-check table, then "Import N candidates", which sends valid rows one at a time;
  - per-row states: Queued, Importing, Staged, Duplicate (409), Failed.
  - When it finishes it calls `onDraftsParsed`, so UploadPage's "Open Review Workspace" banner appears.
- `UploadPage`: a "CV files | JSON + CVs" switch, rendered only when `useAuth().isSuperAdmin`.

## 8. Security & auth
- Both endpoints are SuperAdmin only (401 anonymous, 403 Admin, Recruiter and Interviewer), covered in `ControllerAuthorizationTests`.
- The same file rules as the CV upload apply: extension, size, content-hash duplicate check, and a server-issued stored name.
- The entry is untrusted. Every value is validated and length-checked on the server (an entry is at most 256 KB, `summary` 4000 and `skills` 2000 characters, an experience description 4000, at most 50 education or experience rows); the client pre-check is a convenience only. Values echoed into messages, logs and the audit summary are flattened (no control characters) and shortened.
- `CvFileIntake` also checks the file signature (`%PDF-` / zip header), for the CV upload as well.
- Template comments include admin-entered role and source names, and an AI reads the template. Each name is flattened to one line (so it cannot forge an extra instruction line), capped at 150 characters, and `*/` is broken up so it cannot end the comment block.

## 9. Acceptance criteria / verification
- [x] The template downloads with current role and source names, and parses (comments skipped) into one sample entry.
- [x] JSON with comments, trailing commas, any key casing, and skills as a list or a string imports correctly.
- [x] An entry without its CV, or with an invalid name or email, is not imported, and the reason is shown on its row.
- [x] An unknown role or source still imports, with a warning, and the field is left blank.
- [x] An imported draft is Pending, owned by the Super Admin, prefilled from the JSON, and approvable in the Review Workspace.
- [x] Admin, Recruiter and Interviewer get 403 from both endpoints and never see the switch.
- Tests: `CandidateImportServiceTests`, `CandidateImportApiTests`, `ControllerAuthorizationTests` (import rows), `importManifest.test.ts`, `JsonImporter.test.tsx`, `UploadPage.test.tsx`, `e2e/json-import.spec.ts`.

## 10. Open questions
- Should entries without a CV be allowed later? That needs a migration making the draft file columns nullable, and the approve flow must skip the CV record.
