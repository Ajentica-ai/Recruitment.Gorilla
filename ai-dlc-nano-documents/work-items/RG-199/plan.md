<!-- phase: DONE | branch: fix/RG-199/Evaluation-labels | tasks: 3/3
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-199 two labels that contradict their data (bug, standard, small)
## Tasks
- [x] Repro tests first: xUnit one interviewer on two rounds => InterviewerCount 1 (and 2 distinct stays 2); Vitest UpNextCard badge links the oldest pending interview
- [x] InterviewService.GetCandidateEvaluationReportAsync: distinct InterviewerUserId; UpNextCard: open the last (oldest) pending item
- [x] Full dotnet + client suites; ai-docs line if the label is documented
## Tests
- Standard: failing tests first, kept as regression tests.
## Files
- Services/InterviewService.cs, UpNextCard.tsx(+test), InterviewServiceEvaluationTests.cs
