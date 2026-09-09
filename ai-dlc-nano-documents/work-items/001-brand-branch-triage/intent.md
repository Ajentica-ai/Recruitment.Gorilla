# Triage feat/brand-logo-and-dashboard-feeds against develop
- Source: human request
- Type: chore (branch triage, no spec needed per thin-mode binding)

## Request
- Decide whether `feat/brand-logo-and-dashboard-feeds` is still worth merging into `develop`.
- develop has since taken the Harbor UI redesign (#35): full shadcn/ui migration, Bootstrap removed.
- Identify commit by commit what should still be taken from the branch.

## Findings (evidence, not inference)
- Branch has 3 commits; develop has 4 since merge-base `e001801`. Not merged. `git merge-tree` gives 4 conflicts.
- `021d07a` brand/logo: **still needed.** develop's `BrandLogo.tsx` is byte-identical to merge-base and
  still renders the old inline SVG; `index.html` still points at `favicon.svg`. Merges with no conflict.
- `d412884` dashboard feeds: **superseded.** develop already caps both feeds
  (`data.slice(0, 2)`, `max-h-[380px] overflow-y-auto`) in Tailwind; `.feed-list` has 0 occurrences on develop.
- `ec7d9c8` rubrics gap: **already fixed differently.** develop's wrapper is
  `<div className="evaluation-rubrics-tab page-stack">`, so the stack is on the wrapper and the gap returns.
  Its `frontend.md` corollary ("a tab returns a fragment, not a wrapper") now contradicts develop's own pattern.

## Out of scope
- Merging, pushing, or opening a PR (gated, and merging is never mine to do).
- Deleting the branch (never).
- Porting the feed/rubrics styling into shadcn.

## Follow-ups
- develop's `ai-docs/frontend.md` still has 14 react-bootstrap mentions after #35 removed Bootstrap.
- Feed styling (date tiles, avatars, hover lift) lost with the d412884 revert; re-do under shadcn if wanted.
- Badge not legible at the sidebar 30px (the "Hiring" pill); a badge-only crop for small layouts.
- Port drift: launchSettings/vite proxy use 5134, but AGENTS.md, README, 3 ai-docs files, client/README,
  playwright.config.ts and start-app.bat still say 5000. E2E config points at the dead port.
