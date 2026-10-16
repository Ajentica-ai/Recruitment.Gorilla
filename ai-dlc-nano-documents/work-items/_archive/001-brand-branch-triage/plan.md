<!-- phase: DONE | branch: feat/brand-logo-and-dashboard-feeds (landed on develop) | tasks: 4/5
     base: 602d242 | updated: 2026-09-07
     next: superseded - branch landed on develop as cc5bad9; closed at 002 intake -->
# Plan: reduce the current branch to the brand work, then update it against develop

Revised approach: revert the two dead commits in place instead of branching off
develop and cherry-picking. Verified in a throwaway detached worktree, not asserted.

## Tasks
- [x] `git revert --no-edit ec7d9c8` then `d412884` (newest first). Both applied with
      zero conflicts in the trial; net branch diff then equals 021d07a byte for byte
- [x] Merge `origin/develop` (7816d72) into the branch, resolving the one `index.css`
      conflict: keep the image-based `.brand__mark` block, drop develop's
      `--brand-mark-*` tokens (light ~3641-3643, dark ~3650-3652) and `.brand__mark>svg`;
      only the deleted inline SVG ever read them (verified: no other consumer)
- [x] Re-check the commit's 37-line `ai-docs/frontend.md` hunk against the post-Bootstrap
      reality; rewrite Bootstrap-era wording rather than carrying it over
- [ ] Update `PROJECT_PLAN.md` to describe develop as final: React 19, shadcn/ui + Radix,
      Bootstrap removed, current structure (49 components / 17 pages, not the Phase 1 tree)
- [x] Verify (below), then report. No push, no PR, no merge of the branch itself

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
