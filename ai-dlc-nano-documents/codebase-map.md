# Codebase Map
<!-- generated: 2026-09-06 @ ec7d9c8 - tier: standard - coverage: guardrail + anchors only
     index.css size + tracked-file count re-verified 2026-10-10 @ 69bcf33 (003-docs-map-refresh)
     frontend.md crossed the 500-line cap 2026-10-16 @ fe76b20 (RG-173); anchors re-stamped 2026-10-18 @ 58e13bd (RG-169) -->

**Routing lives in `AGENTS.md` ("Where things are") and `ai-docs/README.md`.**
Go there first. This file deliberately holds only the two things those do not:
the expensive-file guardrail and the anchor index for long documents.

## Do not read in full
| File | Size | Why | Instead |
|---|---|---|---|
| `server/Recruitment.Gorilla.API/Migrations/*.Designer.cs` | up to 98 KB each | EF Core generated | `git grep -n "<col>" -- server/**/Migrations`; regenerate with `dotnet ef migrations add` |
| `server/Recruitment.Gorilla.API/Migrations/AppDbContextModelSnapshot.cs` | 98 KB | EF Core generated | same; never hand-edit |
| `client/package-lock.json` | 246 KB | npm lockfile | `npm ls <pkg>` |
| `client/src/index.css` | 8267 lines | hand-written theme, far over the 500-line read cap | `git grep -n "<token>" -- client/src/index.css`, then `sed -n` a window |
| `client/public/user-guide/images/*.png`, `client/public/logo.png` | 0.1-1.9 MB | binary | do not read |

## Long documents
- `ai-docs/FEATURE_IMPROVEMENT_ROADMAP.md` (959 lines) - read with `sed -n`, never whole
  §1 Exec Summary 11 - §2 Overview 21 - §3 Current State 58 - §4 Problems 81 - §5 UI/UX Audit 98
  §6 Feature Gaps 156 - §7 Recommended Improvements 173 - §8 New Features 371 - §9 AI/Automation 488
  §10 Security 575 - §11 Performance 651 - §12 Accessibility 726 - §13 Tech Debt 763
  §14 Prioritization 799 - §15 Quick Wins 826 - §16 Redesign 839 - §17 Roadmap 862
  §18 Deps/Risks 904 - §19 Design Principles 916 - §20 Top 20 933 - EOF 959
- `ai-docs/frontend.md` (511 lines) - just over the read cap; `sed -n` a section
  Structure 5 - Design system (Harbor) 27 - Page stack 58 - States 80 - Mobile first 92
  Accessibility 151 - Routing & layout 171 - Data fetching 242 - services/api.ts 247
  Key flows 253 - User guide 264 - Dashboard 276 - Interviews/evaluations/notifications 318
  Audit trail 331 - Configuration data notes 334 - Status colors 387 - External links 390
  CV preview 393 - Login 396 - Theme 399 - Dark mode 414 - Configuration page 471
  Build/typecheck 504 - EOF 511
- Every other `ai-docs/` file and every `ai-docs/specs/` file is under 500 lines: read whole.

## Gotchas not covered by ai-docs
- `dotnet build` fails while the API is running (exe lock) - stop it first.
- `dotnet test` needs a local MySQL instance up.
- The MySQL client is NOT on PATH and NOT under `C:\Program Files\MySQL`. Use the
  9.7 bundle's own binary under
  `C:\Users\Tahmid\Downloads\mysql-enterprise-9.7.1_winx64_bundle\...\bin\mysql.exe`.
  The 8.0.23 client at `C:\tools\mysql\...` fails against the 9.7 server (auth plugin).
  Pass the password via the `MYSQL_PWD` env var, never on the command line.
- Migrations are generated: change the entity and re-scaffold, never edit the Designer file.
- `npm run e2e` runs against an **already-running** stack (API on 5134 + Vite on 5173); it starts
  neither. A second `npm run dev` silently takes port 5174, which the Playwright baseURL ignores.
- `POST /api/candidates` is the import path and rejects a CV file it has no upload session for, so
  an e2e spec cannot fabricate a candidate with it.
