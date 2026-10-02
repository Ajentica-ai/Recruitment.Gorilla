<!-- phase: DONE | branch: fix/RG-101/Analytics-workload-scope | tasks: 5/5
     base: 1b8af84 | updated: 2026-10-02
     next: none; awaiting commit/PR on request -->
# Plan: Scope analytics workloads and roleId filter to the caller
## Tasks
- [x] Repro tests (fail first): scoped Recruiter's workload counts exclude out-of-scope transitions/interviews; Recruiter + roleId of an unassigned role sees no foreign candidates
- [x] `GetSummaryAsync`: apply roleId as an extra filter on top of the Recruiter scope, not instead of it
- [x] `CalculateRecruiterWorkloadsAsync`: filter StatusHistories by CandidateId and InterviewInterviewers by Interview.CandidateId against the scoped candidate ids (all callers)
- [x] Update ai-docs/backend.md (analytics row: workload + roleId honour scope)
- [x] Full verify: dotnet build, dotnet test, npx tsc -b, npm test, lint
## Tests
- High blast radius (permissions). AnalyticsServiceTests: Recruiter vs Admin workload counts on a mixed dataset;
  roleId for unassigned role -> 0 candidates; roleId for assigned role -> narrowed; owned candidate in an
  unassigned role still visible with that roleId; existing Admin roleId test unchanged. Live check of GET /api/analytics.
## Files
- server/Recruitment.Gorilla.API/Services/AnalyticsService.cs
- server/Recruitment.Gorilla.Tests/AnalyticsServiceTests.cs
- ai-docs/backend.md
