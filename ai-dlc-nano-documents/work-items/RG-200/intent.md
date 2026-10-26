# Analytics loads every candidate and status row into memory on each request
- Source: issue #200 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/200
- Type: improvement (label "Improvements", not bug) -> feature/ branch
## Request
- AnalyticsService.GetSummaryAsync loads the whole in-scope candidate set + StatusHistories + SourceOption + OwnerUser, then filters by period in memory; workloads load all users and all interviewers in period.
- Own copies of the terminal status sets instead of CandidateBuckets; team workloads match StatusHistory.ChangedBy by display name.
- Suggested: period filter in SQL, project less, split query, GroupBy in SQL, reuse CandidateBuckets, seeded perf test.
## Decisions
- Behaviour-preserving SQL pushdown (window prefilter, split query, owner GroupBy, scoped users/interviews) -> go with recommendation
- Reuse CandidateBuckets Positive/NegativeTerminal only (offer sets belong to #222) -> go with recommendation
- Keep name/email matching; ChangedByUserId column goes to backlog -> go with recommendation
- Deterministic perf test (3k out-of-window rows) + TotalAssigned regression, no wall-clock -> go with recommendation
## Findings
- StatusHistory has no ChangedByUserId (only ChangedBy string), so the issue's "use ChangedByUserId where present" needs a migration + backfill: out of scope.
- Workload TotalAssigned/ActiveCandidates count ALL owned candidates, not just the period, so a naive prefilter would change them: they must be computed separately.
## Out of scope
- ChangedByUserId column (migration), wall-clock perf test.
## Follow-ups
