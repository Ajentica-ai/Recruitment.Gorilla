<!-- phase: DONE | branch: feature/RG-200/Analytics-sql-filtering | tasks: 5/5
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-200 analytics stops loading the whole candidate table (improvement, standard)
## Tasks
- [x] Safety net first: run existing AnalyticsServiceTests green; add tests: window prefilter returns only in-window candidates (3k old rows seeded), TotalAssigned/Active still count old owned candidates, scoped recruiter totals, previous-period trend unchanged
- [x] AnalyticsService: internal BuildWindowQuery (CreatedAt or StatusHistories in [prevStart, periodEnd]), AsNoTracking + AsSplitQuery, drop Include(OwnerUser)
- [x] Workloads: owner totals/active via SQL GroupBy over the scoped set; only active Recruiter/Admin/SuperAdmin users; interviewer counts grouped in SQL for scoped candidates
- [x] Use CandidateBuckets.PositiveTerminal/NegativeTerminal; remove local copies
- [x] Full dotnet + client suites; results identical to before on seeded data; ai-docs note; backlog: ChangedByUserId
## Tests
- Standard (refactor): existing tests as the net, plus the new equivalence/prefilter tests; no wall-clock timing.
## Files
- Services/AnalyticsService.cs, AnalyticsServiceTests.cs, ai-docs/backend.md
