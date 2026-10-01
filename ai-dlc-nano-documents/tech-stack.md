# Tech Stack

**`AGENTS.md` and `ai-docs/` are the source of truth. Nothing here restates them.**
Read `AGENTS.md` first, then the relevant `ai-docs/` file. This file holds only the
facts the ai-dlc-nano workflow itself needs.

- Stack: see `AGENTS.md` § "Tech stack (pinned)". Do not duplicate versions here.
- Conventions: `ai-docs/conventions.md`. Feature recipe: `ai-docs/feature-playbook.md`.
- Size tier: standard - 430 tracked files - re-checked 2026-10-01 (was 426; no tier change)
- Code-intelligence MCP: none

## Verify commands (used by CONSTRUCT)
The playbook's "Verification checklist" is the authority; this is the short form.
- `cd server/Recruitment.Gorilla.API && dotnet build`  (stop the running API first, it locks the exe)
- `cd server && dotnet test`                            (needs local MySQL)
- `cd client && npx tsc -b && npm test`
- `cd client && npm run lint`                           (oxlint)
- `cd client && npm run e2e`                            (Playwright, when UI flows change)

## Workflow bindings (how nano defers to this repo)
- **CONSTRUCT follows `ai-docs/feature-playbook.md` steps 1-11 and its verification
  checklist.** Nano supplies the gates and the trail, not the build order.
- **Specs stay in `ai-docs/specs/`.** For a feature, write the spec from
  `ai-docs/spec-template.md` as usual (playbook step 0); `intent.md` then just points
  at it. For a bug or small change, `intent.md` alone is enough - no spec.
- **WRAP-UP updates `ai-docs/` first** (project rule 4), then `codebase-map.md`.
- Commits carry no AI attribution, and no em-dash characters.
- **Project prefix: `RG`.** Work-item folders are the bare tracker key: `ai-dlc-nano-documents/work-items/RG-<issue number>/` (e.g. `RG-76`). Branch names add the issue type (skill gate 2):
  Bug -> `fix/RG-<issue number>/<Simple-Title>`,
  Feature -> `feature/RG-<issue number>/<Simple-Title>`.
  Take the type from the GitHub issue's labels at INTAKE. Titles are short and
  hyphenated, e.g. `fix/RG-76/Eval-submitted-notification`.
