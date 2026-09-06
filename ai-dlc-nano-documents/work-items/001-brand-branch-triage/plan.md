<!-- phase: PLAN | branch: feat/brand-gorilla-badge (not yet created) | tasks: 0/5
     base: 7816d72 (origin/develop) | updated: 2026-09-06
     next: get plan + branch approval, then cherry-pick 021d07a -->
# Plan: land the gorilla badge on develop, retire the rest of the branch

Develop is authoritative. Only 021d07a survives; d412884 and ec7d9c8 are dropped
(superseded / already fixed) per intent.md findings.

## Tasks
- [ ] Create `feat/brand-gorilla-badge` off `origin/develop` (7816d72)  [HARD GATE]
- [ ] Cherry-pick 021d07a; resolve the single `index.css` conflict: keep the branch's
      image-based `.brand__mark` block, drop develop's `--brand-mark-*` tokens
      (light ~3641-3643, dark ~3650-3652) and `.brand__mark>svg` - only the deleted
      SVG ever read them (verified: no other consumer on develop)
- [ ] Re-check the commit's 37-line `ai-docs/frontend.md` hunk against the post-Bootstrap
      reality; rewrite any Bootstrap-era wording rather than importing it wholesale
- [ ] Update `PROJECT_PLAN.md` to describe develop as final: React 19, shadcn/ui + Radix,
      Bootstrap removed, current structure (49 components / 17 pages, not the Phase 1 tree)
- [ ] Verify (below), then report; no merge, no push, no PR

## Tests
- Rigor: **standard, no new automated test.** A logo/asset swap has no behavior to
  regress; a test would restate an import path. Decision, not omission.
- Existing suites must stay green: `npx tsc -b`, `npm run lint`, `npm test`.
- Manual, both themes: sidebar 30px, login lockup, favicon; confirm no white plate
  in dark mode (the exact failure the old inline SVG existed to avoid).

## Files
- client/src/components/BrandLogo.tsx, client/index.html, client/src/index.css
- client/src/assets/brand-logo.png (+), client/public/favicon.png (+), favicon.svg (-)
- ai-docs/frontend.md, PROJECT_PLAN.md
