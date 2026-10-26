<!-- phase: WRAP-UP | branch: fix/RG-191/Unsavable-evaluation-draft | tasks: 0/7
     base: e9d40c4 | updated: 2026-10-24
     next: user yes to push + PR (Closes #191)
# Plan: RG-191 an evaluation draft can always be saved (bug, standard rigor)
## Tasks
- [x] Repro first: Vitest (payload still carries a stale key; toast ignores the server message; the form renders built-in sections before the rubric loads) and backend (deactivating or un-defaulting the default rubric succeeds today)
- [x] EvaluationForm: payload items filtered to the current rubric's keys; loading panel while the rubric query loads; 404 keeps the built-in form, other errors show an error panel with Retry; onError toasts the server message (string or {message}) via the existing serverErrorMessage helper, generic text as fallback
- [x] EvaluationRubricService.UpdateAsync: refuse to deactivate the default rubric and to clear its default flag (400 with a message telling the admin to designate another default first); create/set-default/delete behaviour unchanged
- [x] Vitest: payload excludes unknown keys, error toast shows the server message (400 and 409), no form before the rubric loads, 404 falls back to built-in, error panel + Retry, a normal custom-rubric save still sends its keys; backend: both refusals, a normal update still works, the default can still be re-saved while staying default and active
- [x] Docs: ai-docs/frontend.md (evaluation form), backend.md (rubric guard)
- [x] dotnet test, npx tsc -b, npm test, lint; isolated stack check of a stale-key draft (save succeeds after the fix) with a screenshot of the error panel path if cheap; notes/backlog
## Tests
- Bug: failing repro first, kept as regression. Rigor: standard (no migration, no auth change).
## Files
- client: components/EvaluationForm.tsx (+tests); server: Services/EvaluationRubricService.cs, tests; ai-docs
