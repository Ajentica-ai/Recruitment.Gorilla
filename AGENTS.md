# AGENTS.md — Read This First

You are working on **Recruitment Gorilla**, a recruitment management system: an admin uploads CVs (PDF/Word) in bulk, the app extracts candidate details for review, stores candidates, and tracks an append-only status history shown as a timeline.

This file is the entry point for any AI agent (or new human contributor). Detailed docs live in **[`ai-docs/`](ai-docs/)** — read [`ai-docs/README.md`](ai-docs/README.md) next.

## Golden rules
1. **Follow the existing patterns.** This codebase has a consistent flow; match it rather than introducing new styles or libraries. The layered flow and conventions are in [`ai-docs/conventions.md`](ai-docs/conventions.md) and [`ai-docs/feature-playbook.md`](ai-docs/feature-playbook.md).
2. **Never expose the backend to the network.** In local dev, only the frontend (Vite, port 5173) is reachable on the LAN; it proxies `/api` to the backend on `localhost:5134`. Under the container deployment (`Gorilla.Platform/deploy`), the equivalent rule is: application containers declare no `ports:` and are reachable only on the `gorilla` bridge network — only the gateway container publishes a host port. Keep whichever form applies to how you're running it. See [`ai-docs/architecture.md`](ai-docs/architecture.md).
3. **No secrets in source.** The DB connection string, `Jwt:Key`, and `Auth:PasswordHash` live in **.NET user secrets**, never in `appsettings.json` or commits. See [`ai-docs/dev-setup.md`](ai-docs/dev-setup.md).
4. **Keep docs in sync.** If you change code, update the matching file in `ai-docs/`.
5. **No AI attribution anywhere in this repo.** Not in commit messages, PR titles/descriptions, code comments, or docs: no `Co-Authored-By` trailer for Claude/Anthropic or any AI tool, no "Generated with Claude Code" (or similar) line, no robot emoji, no statement that a change, comment, or doc was written by AI. Commit only when asked. Branch off the default branch first if needed.
6. **No em-dash characters (U+2014)** in code, comments, commit messages, PR text, or docs. Use a comma, a colon, parentheses, or rewrite the sentence.
7. **Confirm before destructive or outward-facing actions** (deleting data, pushing, exposing services).
8. **Keep tests green.** Add/adjust tests for new business rules and every `[Authorize]` gate; run `dotnet test` + `npm test` before finishing. Patterns + how-to: [`ai-docs/dev-setup.md`](ai-docs/dev-setup.md) §4b and [`ai-docs/conventions.md`](ai-docs/conventions.md).

## The flow in one picture
```
Browser (5173)  ──/api──►  Vite dev proxy  ──►  ASP.NET Core API (localhost:5134)  ──►  MySQL
  React 19/TS                                    Controller → Service → AppDbContext (EF Core)
  TanStack Query                                 JWT auth (access token + httpOnly refresh cookie)
  react-bootstrap (Prism design system)
```
Adding a feature almost always follows: **Entity → AppDbContext → migration → DTO → Service → Controller (`[Authorize]`) → `api.ts` → `types` → Query/Mutation → page/component → verify.** Full recipe: [`ai-docs/feature-playbook.md`](ai-docs/feature-playbook.md).

## Tech stack (pinned)
- **Backend:** ASP.NET Core Web API on **.NET 10**, EF Core **9.0.0** + Pomelo MySQL **9.0.0**, JWT bearer auth, log4net, Swagger.
- **Frontend:** React **19** + TypeScript + **Vite**, TanStack Query v5, Axios, react-bootstrap 2 + Bootstrap 5 (**Prism design system**, see [`ai-docs/frontend.md`](ai-docs/frontend.md)), react-router-dom 7, react-dropzone, lucide-react.
- **DB:** MySQL 8+. **Files:** stored on local disk under `server/Recruitment.Gorilla.API/Uploads/`.

## Quickstart
```bash
# 1. Secrets (once per machine) — see ai-docs/dev-setup.md for full details incl. the password-hash snippet
cd server/Recruitment.Gorilla.API
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Port=3306;Database=RecruitmentGorilla;User=root;Password=<yours>;"
dotnet user-secrets set "Jwt:Key" "<random 32+ byte base64>"
dotnet user-secrets set "Encryption:Key" "<32+ char random string>"
dotnet user-secrets set "Auth:PasswordHash" "<pbkdf2 hash>"   # hash of the default password, admin
dotnet user-secrets set "Slack:BotToken" "<xoxb-... bot token>"   # optional — Slack can also be configured from Configuration → Slack

# 2. Database
dotnet ef database update

# 3. Run (two terminals)
cd server/Recruitment.Gorilla.API && $env:ASPNETCORE_ENVIRONMENT="Development"; dotnet run --urls http://localhost:5134
cd client && npm install && npm run dev      # http://localhost:5173

# 4. Verify a change
cd server/Recruitment.Gorilla.API && dotnet build     # stop the running API first (it locks the exe)
cd server && dotnet test                              # unit + integration (local MySQL running)
cd client && npx tsc -b && npm test                   # types + Vitest
```
Default admin login: **admin@recruitmentgorilla.com / admin**.

## Where things are
| Area | Path |
|---|---|
| API entry/config | `server/Recruitment.Gorilla.API/Program.cs` |
| Controllers | `server/Recruitment.Gorilla.API/Controllers/` |
| Services (business logic) | `server/Recruitment.Gorilla.API/Services/` |
| EF entities | `server/Recruitment.Gorilla.API/Models/` |
| DbContext | `server/Recruitment.Gorilla.API/Data/AppDbContext.cs` |
| DTOs | `server/Recruitment.Gorilla.API/DTOs/` |
| Frontend API layer | `client/src/services/api.ts` |
| Shared TS types | `client/src/types/index.ts` |
| Backend tests (xUnit) | `server/Recruitment.Gorilla.Tests/` |
| Frontend tests (Vitest) `*.test.ts(x)` + E2E | `client/src/**`, `client/e2e/` |
| Pages / components | `client/src/pages/`, `client/src/components/` |
| Auth (frontend) | `client/src/auth/AuthContext.tsx` |
| Theme | `client/src/index.css` |
| Full docs | `ai-docs/` |
