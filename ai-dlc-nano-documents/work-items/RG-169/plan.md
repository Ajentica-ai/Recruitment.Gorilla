<!-- phase: DONE | branch: fix/RG-169/Recruiter-upload-no-opening | tasks: 8/8
     base: 58e13bd | updated: 2026-10-18
     next: none - complete, uncommitted on fix/RG-169/Recruiter-upload-no-opening -->
# Plan: Recruiter cannot upload CVs (#169)
Cause and evidence: `intent.md`. The scoping is correct and documented; the page dead-ends silently.
## Tasks
- [x] 1. `utils/jobOpenings.ts`: `offerableJobOpenings(roles)`, the open/closing-soon filter currently duplicated verbatim in `BulkUploader.tsx:47` and `JsonImporter.tsx:58`
- [x] 2. `components/common/NoJobOpeningNotice.tsx`: the shared empty state, role-aware per the copy below
- [x] 3. `BulkUploader`: when nothing is offerable, render the notice instead of the inert dropzone and keep the file input unreachable
- [x] 4. `JsonImporter`: same treatment on the import panel
- [x] 5. `CandidateForm`: notice beside "Role applied for" when the list is empty, so creating a candidate fails visibly rather than on save
- [x] 6. `DraftReviewWorkspace`: notice when the list is empty, since approving a draft needs an opening
- [x] 7. Tests: one per surface (4 files), each asserting the notice appears when the list is empty and does not when it is not
- [x] 8. Docs: `ai-docs/frontend.md` + the recruiter user-guide chapter
## Copy (approve or correct at the gate)
The rule is final: a Recruiter without an assignment cannot upload, an Admin can. The notice says
exactly that, in the reader's own situation. Two short variants, chosen by role:

> *Recruiter:* **You are not assigned to a job opening.** A CV is uploaded against an opening, so
> you cannot upload until an admin assigns you to one.

> *Admin:* **There are no open job openings.** A CV is uploaded against an opening, so create or
> reopen one before uploading.

This revisits the earlier "one message" answer deliberately: since an Admin is never blocked by
assignment, showing them the Recruiter sentence would state the opposite of the rule. Role comes from a new
`useOptionalAuth()` rather than `useAuth()`: the four host components have no provider in their
tests, and `AuthProvider` refreshes the session over the network on mount, so a throwing hook
would have forced auth bootstrapping into forty unrelated tests. Absent auth falls back to the
Recruiter wording, the narrower of the two.
## Tests
Standard. No server change, so no new backend tests; `npm test` + `npx tsc -b` + `npm run lint`,
and `dotnet test` once to prove the backend is untouched. Verified in the browser as a Recruiter
with no assigned opening, which is the reported state.
## Files
`client/src/utils/jobOpenings.ts`, `client/src/components/common/NoJobOpeningNotice.tsx`,
`BulkUploader.tsx`, `JsonImporter.tsx`, `CandidateForm.tsx`, `drafts/DraftReviewWorkspace.tsx`,
their four `*.test.tsx`, `ai-docs/frontend.md`, `UserGuide/chapter-2-recruiter.md`.
