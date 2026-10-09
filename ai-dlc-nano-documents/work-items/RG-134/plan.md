<!-- phase: DONE | branch: feature/RG-134/Dashboard-redesign | tasks: 10/10
     base: a1a6644 | updated: 2026-10-10
     next: none. Not committed; awaiting user (commit, push, PR are gated) -->
# Plan: Dashboard redesign, action-first and mobile-first (RG-134)
## Tasks
- [x] 1. API: `DashboardKpisDto` + `NewPrevWeek`, `RecommendedThisWeek`, `RejectedThisWeek` (first bucket entry in 7d); `ApplicationsSummaryDto` + `GET /api/dashboard/applications-summary?days=`
- [x] 2. Server tests: new `DashboardServiceTests` (7d/14d boundaries, first-entry rule, summary windows + clamp); auth matrix rows for the new endpoint
- [x] 3. Client data: types, `getApplicationsSummary`, all queries under `['dashboard']`, `staleTime` 60s, refresh = invalidate `['dashboard']`
- [x] 4. CSS: dashboard block in `index.css` (strips, pipeline bar, stage rows, job rail, FAB, activity groups); `min-width` only, tokens only, 44px targets, reduced motion
- [x] 5. Hero + `QuickActionFab` (updated-at/refresh, scroll chips); `KpiCard` delta + `useCountUp`; `KpiStrip` (carousel + dots on phone, 3x2 from 560px)
- [x] 6. `UpNextCard` (Mine: awaiting-eval + upcoming by day; Team: scoped, writers only; slim empty) replacing `MyInterviewsCard` + page "Upcoming interviews"
- [x] 7. `PipelineCard` (stacked bar + rows, All/Active, show all, drill-through for writers) replacing `StatusDonutChart`; `TrendChart` summary header + bar readout
- [x] 8. `ActiveJobOpeningsCard` (rail/grid, sort by end date, first 6), `PipelineInsightsCard` (Roles/Skills), compact `OfferMetricsCard`, `ActivityFeed` (day groups, collapse)
- [x] 9. `DashboardPage` recomposed per mockup; delete replaced components; Vitest for each new component + `DashboardPage.test.tsx` role matrix; port old tests
- [x] 10. E2E `dashboard-responsive.spec.ts` (360/390/768/1280/1600, both themes, overflow, FAB, screenshots); docs: frontend.md, backend.md, dashboard spec, user guide if layout described
## Tests
- Standard tier. xUnit service + auth tests; Vitest per component and page role matrix (Interviewer / Recruiter / Admin).
- Full `dotnet test` + `npx tsc -b` + `npm run lint` + `npm test`; Playwright spec against the running stack; manual check at 5 widths x 2 themes vs mockup.
## Files
- server: `DTOs/DashboardDtos.cs`, `Services/DashboardService.cs`, `Controllers/DashboardController.cs`, Tests `DashboardServiceTests.cs` (new), `ControllerAuthorizationTests.cs`
- client: `types/index.ts`, `services/api.ts`, `index.css`, `pages/DashboardPage.tsx` (+ new test), `hooks/useCountUp.ts` (new)
- client/components/dashboard: `DashboardHero`, `KpiCard`, `TrendChart`, `OfferMetricsCard` (edit); `KpiStrip`, `UpNextCard`, `PipelineCard`, `ActiveJobOpeningsCard`, `PipelineInsightsCard`, `ActivityFeed`, `QuickActionFab` (new, with tests); `StatusDonutChart`, `MyInterviewsCard`, `ActiveJobOpeningsTable` (+ tests) removed
- e2e: `client/e2e/dashboard-responsive.spec.ts`; docs: `ai-docs/frontend.md`, `ai-docs/backend.md`, `ai-docs/specs/recruitment-dashboard-and-job-openings.md`
