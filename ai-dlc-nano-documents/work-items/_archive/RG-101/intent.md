# Analytics team workloads count activity org-wide for scoped Recruiters
- Source: issue #101 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/101
- Type: bug
## Request
- `CalculateRecruiterWorkloadsAsync` loads every StatusHistory and InterviewInterviewer in the period with no scope, so a scoped Recruiter sees org-wide colleague activity counts.
- Other workload columns (TotalAssigned, ActiveCandidates, HiresMade) already come from the scoped candidate set; make the table consistent.
- ai-docs/backend.md says /api/analytics, incl. recruiter workload, is scoped to recruiter roles.
## Decisions
- Workload scoping? -> count transitions/interviews only on the caller's scoped candidate set, for every role (Admin + roleId stays consistent); all recruiter rows still listed.
- Fold in the roleId bypass (roleId replaced Recruiter scope instead of narrowing it)? -> yes, roleId now intersects with scope.
## Out of scope
- Restricting non-Admins to their own workload row.
## Follow-ups
- ControllerAuthorizationTests.Deleting_a_candidate_writes_an_audit_row is flaky in the full suite (500ms poll for async audit row).
