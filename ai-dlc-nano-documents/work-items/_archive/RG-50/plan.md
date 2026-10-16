<!-- phase: DONE | branch: fix/RG-50/Recruiter-access-scope-check | tasks: 5/5
     base: 0d2beb9 | updated: 2026-10-02
     next: none; PR #107 awaiting review, #50 closed -->
# Plan: Prove Recruiter access is scoped, then close #50
## Tasks
- [x] Branch off origin/develop (worktree, so the main checkout is untouched)
- [x] New e2e spec client/e2e/recruiter-scope.spec.ts (Recruiter via E2E_EMAIL, Admin via
      E2E_ADMIN_EMAIL): Recruiter reaches Upload CVs and Candidates (by design); an Admin's draft
      is absent from the Recruiter's list and is 404 by id, edit, approve, discard; an Admin's
      candidate in no assigned role is absent from the list and 404 by id; the Recruiter's own
      upload is visible to them. Seeds via e2e/seed.ts, cleans up everything it creates.
- [x] Add the spec to the skip table in ai-docs/dev-setup.md
- [x] Run it: red on pre-#103 API (draft read 200), green on develop; dotnet test 299/299 (private API + Vite on spare ports), plus tsc and lint
- [x] #50 commented and closed; PR #107 opened (user confirmed)
## Tests
- High blast radius (auth): the new spec is the test; it checks both refusal and allowed paths.
  Backend unit/integration tests for these rules already landed in #103/#106 (still unrun here:
  the MySQL test credential is rejected).
- [x] REVISED: DbTestBase.SignedIn shared one ambient HttpContext; 4 #103 tests ran as the wrong user
## Files
- client/e2e/recruiter-scope.spec.ts (new), client/e2e/seed.ts (uploadDraft), DbTestBase.cs, ai-docs/dev-setup.md
