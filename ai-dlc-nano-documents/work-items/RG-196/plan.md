<!-- phase: DONE | branch: fix/RG-196/Candidate-list-paging | tasks: 4/4
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-196 clamp list paging, tell the board when it truncates (bug, standard)
## Tasks
- [x] Repro tests: HTTP page=0/-5 is 200 (was 500), pageSize=0/1000000 clamped to 1..200 and echoed in the response; huge page does not overflow; service-level clamp
- [x] CandidateService.GetAllAsync: clamp page (1..max that cannot overflow) and pageSize (1..200); PagedResult echoes the clamped values
- [x] CandidatesPage: board uses a named BOARD_PAGE_SIZE (150); when totalCount > items shown, a notice "Showing 150 of N candidates. Narrow the filters to see the rest." (+ Vitest)
- [x] ai-docs/backend.md list row; full dotnet + client suites
## Tests
- Standard: failing tests first and kept; HTTP for the 500, Vitest for the notice.
## Files
- Services/CandidateService.cs, CandidatesPage.tsx(+test), tests, ai-docs/backend.md
