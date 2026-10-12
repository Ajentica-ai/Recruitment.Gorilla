# Codebase Map
<!-- generated: 2026-09-06 @ ec7d9c8 - tier: standard - coverage: guardrail + anchors only
     index.css size + tracked-file count re-verified 2026-10-10 @ 69bcf33 (003-docs-map-refresh) -->

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
