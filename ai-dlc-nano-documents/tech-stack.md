# Tech Stack

**`AGENTS.md` and `ai-docs/` are the source of truth. Nothing here restates them.**
Read `AGENTS.md` first, then the relevant `ai-docs/` file. This file holds only the
facts the ai-dlc-nano workflow itself needs.

- Stack: see `AGENTS.md` § "Tech stack (pinned)". Do not duplicate versions here.
- Conventions: `ai-docs/conventions.md`. Feature recipe: `ai-docs/feature-playbook.md`.
- Size tier: standard - 322 tracked files - recorded 2026-09-06
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
