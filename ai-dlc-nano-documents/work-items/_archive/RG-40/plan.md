<!-- phase: DONE | branch: feature/RG-40/Password-visibility-icon | tasks: 2/2
     base: 1e398c7 | updated: 2026-10-11
     next: none. PR #142 open against develop @af68f7f. -->
# Plan: Add password visibility icon to Temporary Password fields

## Tasks
- [x] Add User modal: replace `Input` with `PasswordInput` for the temporary
      password field (`client/src/pages/UsersPage.tsx` ~line 343).
- [x] Reset password modal: replace `Input` with `PasswordInput` for the
      temporary password field (same file, ~line 390).

## Tests
- Trivial UI swap onto an existing, already-tested shared component
  (`PasswordInput` has its own coverage). Verify by observation: run the
  frontend, open Add User and Reset password, confirm the eye icon toggles
  masked/plain text and the field submits normally. Run `npx tsc -b` and the
  existing UsersPage tests if any exist.

## Files
- client/src/pages/UsersPage.tsx
