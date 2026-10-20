<!-- phase: WRAP-UP | branch: fix/RG-189/Cancelled-interview-evaluation | tasks: 6/6
     base: e9d40c4 | updated: 2026-10-22
     next: user yes to push + PR (Closes #189)
# Plan: RG-189 no evaluating cancelled interviews (bug, standard rigor)
## Tasks
- [x] Repro first (backend): failing tests that save a draft and submit on a cancelled interview (today 200, expect 409 with no row written and no "Evaluation submitted" notification), that GetDetail says canEvaluate for a cancelled interview, and that the candidate report counts a submitted evaluation on a cancelled interview
- [x] InterviewService: UpsertEvaluationAsync returns Conflict "This interview was cancelled." when Status is Cancelled (checked before anything is written); GetDetailAsync CanEvaluate = isAssigned && Status != Cancelled; GetCandidateEvaluationReportAsync skips cancelled interviews; the controller maps the conflict to 409
- [x] Client InterviewPage: for a cancelled interview show a read-only "This interview was cancelled" panel instead of the form, and no relative "Completed"/Today/Tomorrow chip (keep the Cancelled badge); non-cancelled behaviour unchanged
- [x] Vitest: no evaluation form and the cancelled panel for a cancelled interview, no "Completed" label for a past cancelled one, form still shown for a live one
- [x] Docs: ai-docs/backend.md (rule), frontend.md (interview page), auth.md only if it lists who may evaluate
- [x] dotnet test full, npx tsc -b, npm test, lint; isolated real-API + UI check of the cancelled page (own ports, throwaway DB); notes/backlog
## Tests
- Bug: failing repro first, kept as regression. Rigor: standard (no migration, no auth change).
## Files
- Services/InterviewService.cs, Controllers/InterviewsController.cs (if the 409 mapping needs it), tests (InterviewServiceTests or new), client: pages/InterviewPage.tsx (+test), ai-docs
