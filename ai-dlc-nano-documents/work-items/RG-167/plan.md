<!-- phase: DONE | branch: fix/RG-167/Dashboard-pipeline-card-alignment | tasks: 3/3
     base: fde0630 | updated: 2026-10-15
     next: commit + PR on request -->
# Plan: RG-167 dashboard pipeline card alignment
## Tasks
- [x] index.css: >=1200px .dash-pair flex column, last card flex:1
- [x] Playwright: left column bottom == Recent activity bottom at 1920/1440 (with and without Offers); 1000 and phone unchanged
- [x] tsc + full npm test
## Tests
- Trivial-to-standard CSS: no unit test (JSDOM has no layout); real measurement in Edge
## Files
- client/src/index.css
