<!-- phase: DONE | branch: feature/003-docs-map-refresh | tasks: 8/8
     base: 69bcf33 | updated: 2026-10-10
     next: none. Not committed; awaiting user (commit, push, PR are gated) -->
# Plan: Refresh stale living docs and the codebase map (003)
## Tasks
- [x] 1. `AGENTS.md`: react-bootstrap -> Tailwind v4 + shadcn/Radix; "Prism" -> "Harbor" design system
- [x] 2. `README.md`: same UI/stack correction (bullet, stack table, monorepo tree comment)
- [x] 3. `ai-docs/architecture.md`: stack table UI row; monorepo tree (styles/tokens.css + theme.css
      layering, current pages/ and components/ listing); "single-admin (Phase 1)" opening line ->
      reflect the actual 4-role system
- [x] 4. `ai-docs/conventions.md`: "Components/pages use react-bootstrap" -> Tailwind/shadcn; Theme
      section (Fluent/`--ms-primary`/Segoe UI/`public/logo.png`) -> Harbor tokens/`assets/brand-logo.png`;
      drop the stale "react-bootstrap" half of the "skip snapshots... react-bootstrap/recharts" line
- [x] 5. `ai-docs/feature-playbook.md`: "Build the page/component... with react-bootstrap" -> current
      pattern (Tailwind/shadcn, existing component conventions)
- [x] 6. `ai-docs/frontend.md`: main.tsx imports line (Figtree/Bootstrap CSS -> Plus Jakarta Sans/
      Tailwind); `components/ui/` vs `components/common/` split (currently backwards); `index.css`
      description (bridge -> legacy layer under `theme.css`); Design system intro paragraph (Prism ->
      Harbor, drop the Bootstrap-bridge description); the "Dropdowns must be controlled" gotcha,
      verified obsolete (ThemeMenu/UserMenu/NotificationBell are shadcn `DropdownMenu`, which
      auto-closes on item selection; NotificationBell's own `open` state is for closing before
      `navigate()`, not a workaround) -> rewrite or drop; Theme section (coastal teal/Figtree ->
      Harbor cobalt-violet/Plus Jakarta Sans); the `data-bs-theme`/Bootstrap dark-mode line -> correct
      (it's an app convention `theme.css`'s `@custom-variant dark` reads, not a Bootstrap feature)
- [x] 7. `ai-dlc-nano-documents/codebase-map.md`: re-stamp the generated/verified line; check the
      guardrail table (migrations, package-lock, index.css, images) still matches reality
- [x] 8. `ai-dlc-nano-documents/tech-stack.md`: refresh the tracked-file count (581, was 560);
      `backlog.md`: delete the `docs/PROJECT_PLAN.md` line (that path no longer exists; the root
      `PROJECT_PLAN.md` it meant is in the user-confirmed historical/out-of-scope list)

**Also found, not in the docs scope (your call, not done unless you say so):** `client/src/main.tsx`'s
own comment says "theme.css imports bootstrap, index.css and Tailwind", contradicting `theme.css`'s
own "BOOTSTRAP IS GONE" header one file over. One stale word in a source comment, not a doc.
## Tests
- None — pure documentation and bookkeeping content, no runtime code changes. Verified by re-grepping
  the same stale-pattern search afterward and confirming zero hits outside the agreed historical files.
## Files
- `AGENTS.md`, `README.md`, `ai-docs/architecture.md`, `ai-docs/conventions.md`,
  `ai-docs/feature-playbook.md`, `ai-docs/frontend.md`, `ai-dlc-nano-documents/codebase-map.md`,
  `ai-dlc-nano-documents/tech-stack.md`, `ai-dlc-nano-documents/backlog.md`
