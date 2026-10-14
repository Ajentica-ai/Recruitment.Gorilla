<!-- phase: DONE | branch: fix/RG-51/Funnel-bar-at-zero | tasks: 3/3
     base: c630b32 | updated: 2026-10-12
     next: commit + PR on request -->
# Plan: no filled bar at 0% funnel conversion
## Tasks
- [x] Failing test in AnalyticsPage.test.tsx: a 0% stage's bar fill has width 0%; a small non-zero stage keeps >= 4%
- [x] AnalyticsPage.tsx: width = percent > 0 ? Math.max(4, percent) : 0
- [x] tsc, full npm test, lint; check in the browser with the empty-period view from the issue
## Tests
- Trivial-to-standard: one component test (above) + full suite; browser check of the issue's view
## Files
- client/src/pages/AnalyticsPage.tsx, client/src/pages/AnalyticsPage.test.tsx
