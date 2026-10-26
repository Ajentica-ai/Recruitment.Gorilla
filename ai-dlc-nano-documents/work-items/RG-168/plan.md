<!-- phase: DONE | branch: fix/RG-168/Remove-floating-upload-button | tasks: 5/5
     base: 52d5380 | updated: 2026-10-19
     next: commit + PR on request -->
# Plan: RG-168 remove the floating Upload CVs button
## Tasks
- [x] Remove QuickActionFab (component, import, usage), .quick-fab and .dash-page--fab CSS
- [x] e2e dashboard-responsive: assert no floating Upload CVs button at any width
- [x] Unit test: dashboard renders no floating Upload CVs link; hero buttons inline on phones (user asked)
- [x] Comments and ai-docs/frontend.md mentions
- [x] tsc + npm test; browser check at phone and desktop; run the e2e spec
## Tests
- Standard: Vitest + updated Playwright spec + browser look
## Files
- DashboardPage.tsx, QuickActionFab.tsx (delete), DashboardHero.tsx (comment), index.css, DashboardPage.test.tsx, e2e/dashboard-responsive.spec.ts, ai-docs/frontend.md
