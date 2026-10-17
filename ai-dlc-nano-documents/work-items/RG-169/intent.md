# Recruiter user cannot upload CVs
- Source: issue #169 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/169
- Type: bug (label: bug)

## Request
- A Recruiter opens Upload CVs and cannot upload. The screenshot shows the dropzone inert, reading "Choose a job opening first", with the Job Opening dropdown on "Select Job Opening...".

## Root cause (traced, not inferred)
- `BulkUploader.tsx:42` loads `getActiveRoleOptions` -> `GET /api/candidates/role-options`. `CandidatesController:181` returns **all active openings for Admin+ but only assigned ones for a Recruiter** (`ConfigurationService.GetAssignedRolesAsync`, filtered to `IsActive` + `Recruiters.Any(user)`). The client then keeps only `jobStatus` open/closing-soon.
- A Recruiter assigned to **no open opening** therefore gets an empty dropdown, and since the dropzone is gated on a selection, upload is impossible. Both helpers are correct: `jobStatus` treats a missing or unparseable end date as open, and the server filter is right.
- Reproduced against the dev API: `demo.recruiter@rg.local` is assigned to 1 open opening (QA Engineer) and can upload; SuperAdmin sees 6 offerable of 8. The reporter's recruiter has 0, which is the reported state.
- **The restriction itself is intended and documented** (`ai-docs/auth.md` lines 32 and 39: a job opening is required to upload, a Recruiter is limited to openings they are assigned to, and "a Recruiter with no assigned role can't create candidates until an Admin assigns them one", enforced server-side). So the defect is not the scoping: it is that the UI dead-ends silently, naming neither the cause nor the remedy.

## Siblings (same silent dead end, same scoped list)
- `JsonImporter.tsx:54`, `CandidateForm.tsx:68`, `DraftReviewWorkspace.tsx:173` all read the same `['active-role-options']` query and will be equally stuck for a recruiter with none.
- `BulkUploader.tsx` has no empty-state branch at all today.

## Decisions
- **The rule is final (user, stated explicitly): without being assigned to a job opening a Recruiter cannot upload a CV; an Admin can.** The authorization model is therefore correct as built and is not to be changed. `role-options` stays scoped, and the server-side checks in `CandidateDraftService.ValidateJobOpeningForCallerAsync` and `CandidateService.CreateAsync` stay as they are.
- Fix all four surfaces that share the dead end, not only the reported upload page.

## Out of scope
- Any change to who may upload against which opening. The rule above is settled.
- Auto-assigning a Recruiter to an opening, or letting them self-assign.
- The `jobStatus` mismatch on `CandidateForm` / `DraftReviewWorkspace` (they do not filter out expired openings, so one can be offered and then rejected on save). Recorded as a follow-up, not fixed here.

## Follow-ups
- `CandidateForm` and `DraftReviewWorkspace` do not apply `offerableJobOpenings`, so an expired opening is still offered there and only rejected on save. Deliberately left: it changes which openings are selectable, which is beyond the reported bug.
- The same endpoint is cached under two keys, `['active-role-options']` and `['role-options','active']`, so the uploaders and the forms refetch independently.
- A new `useOptionalAuth()` now exists beside `useAuth()`; worth reusing for other leaves that only vary wording by role.
