<!-- phase: DONE | branch: fix/RG-39/Cancel-user-edit-toast | tasks: 4/4
     base: aba2029 | updated: 2026-10-13
     next: none -->
# Plan: RG-39 Cancel submits Edit User form
## Tasks
- [x] Failing Vitest: Edit user -> Cancel -> updateUser not called, no toast
- [x] UsersPage: type="button" on both Cancel buttons (edit + reset modals)
- [x] Same fix on sibling Cancel buttons inside forms (EvaluationRubricsTab, JobOpeningsTab, AddStatusModal), confirmed each is in a form
- [x] npx tsc -b + npm test; verify Cancel in the running app
## Tests
- Standard: new UsersPage.test.tsx (edit and reset modal Cancel), existing suite green.
## Files
- UsersPage.tsx, UsersPage.test.tsx (new), the three sibling files
