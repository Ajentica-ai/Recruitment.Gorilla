<!-- phase: WRAP-UP | branch: feature/RG-84/Mobile-first-sheet | tasks: 7/7
     base: 99f987f | updated: 2026-10-01
     next: summarise; commit is unmade and push/PR need approval -->
# Plan: Make the Sheet primitive mobile-first

Rigor tier: **standard**. Layout behaviour that can regress silently, so it gets a
geometric e2e check, same approach as RG-81's dialog footer guard.

## Tasks
- [x] `SheetContent`: one right-side variant. Below `sm` a bottom sheet (`inset-x-0
      bottom-0 max-h-[92dvh]`, rounded top, border-top, slide-in-from-bottom); from `sm`
      the current right panel (`sm:inset-y-0 sm:right-0 sm:h-full sm:w-[min(28rem,100vw)]`,
      slide-in-from-right). Delete the `left` / `top` / `bottom` branches and the `side` prop.
- [x] `SheetFooter`: add `DialogFooter`'s two rules, `pb-[max(var(--space-3),env(safe-area-inset-bottom))]`
      and `[&>*]:w-full sm:[&>*]:w-auto`.
- [x] `SheetBody`: mirror the `className="contents"` guard note added to `DialogBody` in
      RG-81, so #85's forms do not reintroduce that bug. Fix the file's doc comment, which
      claims Sheet powers the mobile navigation (it does not; `SidebarNav` hand-rolls an `<aside>`).
- [x] Call sites: prefix the width overrides so they do not fight the phone branch.
      `EvaluationReportDrawer` 52rem and `InterviewPage` 35rem become `sm:w-[...]`.
      `CandidateDetailPage` passes no width and needs no edit beyond dropping `side="right"`.
- [x] `e2e/drawer-mobile.spec.ts`: status-history drawer at 390x844 and 1280x800. Asserts
      bottom-anchored and full-width on the phone, right-anchored on the desktop, and the
      panel's bottom edge inside the viewport. Seeds one candidate via the API and deletes
      it in `finally`. Waits for the open animation to settle (RG-81's 16px trap).
- [x] Verify: `npx tsc -b`, `npm test`, `npm run lint`, the new spec red before the change
      and green after, plus a manual pass over all three drawers at 390 and 1280 in both themes.
- [x] WRAP-UP: `ai-docs/frontend.md` Sheet wording, then `tech-stack.md` file count (430).
      PR #86 merged at 99f987f, so #81 and #70 are closed and RG-81's spec is on develop.

## Tests
- New: `e2e/drawer-mobile.spec.ts` (geometric, must fail before the change).
- Existing: full Vitest suite plus `e2e/smoke.spec.ts` for regressions.

## Files
- `client/src/components/ui/sheet.tsx`
- `client/src/components/EvaluationReportDrawer.tsx`, `client/src/pages/InterviewPage.tsx`,
  `client/src/pages/CandidateDetailPage.tsx`
- `client/e2e/drawer-mobile.spec.ts` (new). `.env.e2e.example` needs no edit:
  RG-81 landed `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` on develop in PR #86.
- `ai-docs/frontend.md`
