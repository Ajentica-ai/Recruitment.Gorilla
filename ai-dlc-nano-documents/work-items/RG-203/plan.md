<!-- phase: DONE | branch: feature/RG-203/My-interviews-page | tasks: 5/6
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-203 My interviews page (feature, standard)
## Tasks
- [x] Backend tests first: each tab's rules, counts, search, paging clamp, own interviews only, submitted rows carry recommendation + rating, cancelled only on its tab, any role may call it
- [x] InterviewService.GetMineHistoryAsync + DTOs (MyInterviewHistoryRowDto, page result with counts) + GET /api/interviews/mine/history
- [x] Client: types, getMyInterviewHistory in api.ts, MyInterviewsPage (tabs with counts, search, Pagination, rows link to /interviews/{id}, rating/recommendation on submitted, empty states)
- [x] Route /my-interviews (all roles) + sidebar entry; Vitest for the page and the nav per role
- [x] ai-docs (backend.md, frontend.md) + user guide (interviewer chapter) note
- [x] Full dotnet + client suites; run API + page against a scratch DB and screenshot; security review (own-data scoping)
## Tests
- Standard: failing tests first; xUnit (service + HTTP incl. Interviewer role), Vitest for UI and nav.
## Files
- Services/InterviewService.cs, Controllers/InterviewsController.cs, DTOs/InterviewDtos.cs, client types/api.ts/MyInterviewsPage.tsx/navRoutes.ts/App.tsx, tests, docs
