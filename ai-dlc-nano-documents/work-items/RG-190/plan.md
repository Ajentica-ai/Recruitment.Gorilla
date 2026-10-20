<!-- phase: WRAP-UP | branch: fix/RG-190/Custom-rubric-ratings-in-report | tasks: 7/7
     base: e9d40c4 | updated: 2026-10-23
     next: user yes to push + PR (Closes #190)
# Plan: RG-190 custom-rubric ratings visible on every view (bug, standard rigor)
## Tasks
- [x] Repro first (Vitest): EvaluationReadOnly with custom-key items draws nothing today (all "-"); report body shows no averages for custom keys. Repro first (backend): report for an interview scored on custom keys has averages only for built-in keys and no criteria list
- [x] Backend: CandidateEvaluationReportDto gains Criteria (key, label, section) = the candidate's resolved rubric + unknown rated keys as "Other criteria" (key as label); CriterionAverageDto covers every rated key in rubric order; rubric resolved once via EvaluationRubricService.GetForInterviewAsync (so #215 improves it automatically)
- [x] Client types + EvaluationReadOnly: render item keys not in the sections under an "Other criteria" group (key as label); EvaluationReportBody builds a rubric-shaped object from report.criteria, passes it to EvaluationReadOnly, and builds averages labels and order from it (built-in sections only as the fallback)
- [x] InterviewPage keeps passing its rubric; covered by the "Other criteria" safety net (own and peers' read-only evaluations)
- [x] Tests: backend (criteria list, unknown keys, averages for custom keys, built-in unchanged, shared report carries criteria) + one HTTP test; Vitest (custom keys render ratings and comments, unknown keys under "Other criteria", averages table with custom labels, built-in report unchanged)
- [x] Docs: ai-docs/backend.md (report shape), frontend.md (report body, EvaluationReadOnly)
- [x] dotnet test, npx tsc -b, npm test, lint; isolated stack + screenshot of the report with a custom-rubric evaluation; notes/backlog
## Tests
- Bug: failing repro first, kept as regression. Rigor: standard (additive DTO field, no migration, no auth change).
## Files
- DTOs/InterviewDtos.cs, Services/InterviewService.cs, tests; client: types/index.ts, components/EvaluationForm.tsx (EvaluationReadOnly), components/EvaluationReportBody.tsx (+tests), ai-docs
