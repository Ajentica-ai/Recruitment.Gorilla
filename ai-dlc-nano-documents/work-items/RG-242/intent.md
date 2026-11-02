# Missing candidate: skip retry on 404, show error immediately
- Source: issue #242 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/242
- Type: bug
## Request
- `/candidates/{id}` for a deleted/non-existent candidate shows "Loading..." 8-10 s because
  TanStack Query retries the 404 three times with backoff before giving up
- Fix: add a per-query `retry` function that returns false on 404, keeps default retries otherwise
- Add a Vitest test: QueryClient with global retry:3, mocked 404, assert error state in <2 s
## Decisions
- Use `isAxiosError` from `axios` (pattern already used in EvaluationForm, EvaluationReportDrawer)
- retry function: `!(isAxiosError(error) && error.response?.status === 404) && failureCount < 3`
- Test uses global retry:3 on QueryClient to prove per-query override, not test helper's retry:false
## Out of scope
- Other queries in CandidatesPage, InterviewPage, etc. (separate issues if needed)
