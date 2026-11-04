<!-- phase: DONE | branch: fix/RG-237/Unknown-url-blank-page | tasks: 3/3
     base: fdeeec2 | updated: 2026-10-29
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-237 a catch-all route for unmatched URLs (bug, standard, fast path)
## Tasks
- [x] Repro test first (render the real <App/> with history pushed to an unknown path; mock only
      services/api.refreshSession (as ProtectedLayout.test.tsx does) and ./components/shell/AppShell
      to a bare <Outlet/>): signed-in + unknown path shows "Page not found" and a link to /; signed-out
      + unknown path is still redirected to /login first
- [x] New NotFoundPage.tsx (EmptyState, page prop, Back to dashboard link); add path="*" as the last
      child route under ProtectedLayout in App.tsx
- [x] Full npm test + tsc; load an unknown path in the running dev app once to see it rendered
## Tests
- Standard: failing test first, kept as the regression test.
## Files
- client/src/pages/NotFoundPage.tsx (new), client/src/App.tsx, client/src/App.test.tsx (new)
