# E2E kanban spec: remove hardcoded URL and credentials
- Source: issue #239 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/239
- Type: bug
## Request
- `kanban-pipeline.spec.ts` navigates to `http://localhost:5173/login` and `/candidates`; ignores `baseURL` from playwright config
- Login is hardcoded to `admin@recruitmentgorilla.com` / `admin` instead of env-driven credentials
- Fix: use relative paths and `signIn(page, ADMIN)` from `e2e/helpers.ts`
## Decisions
- Use `signIn(page, ADMIN)` then `page.goto('/candidates')` (relative); drop the conditional URL check
- Add skip guard inside describe block mirroring other specs' pattern
## Out of scope
- No changes to helpers.ts, playwright.config.ts, or other specs
