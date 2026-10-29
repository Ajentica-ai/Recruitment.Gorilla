# Unknown URLs show a blank page with no navigation
- Source: issue #237 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/237
- Type: bug (labels: bug, UI)
## Request
App.tsx's <Routes> has no catch-all (path="*"); a signed-in user on any unmatched path (e.g.
/no-such-page) gets a totally blank page (no shell, no message), in every role and in the production
build, because React Router renders nothing when no route matches.
## Decisions
- Add one <Route path="*" element={<NotFoundPage />} /> as the LAST child inside the ProtectedLayout
  group, so it still runs the real auth check (unauthenticated -> redirected to /login first, per the
  issue) and, once authenticated, renders inside the normal AppShell via its Outlet -> go with recommendation
- NotFoundPage: EmptyState (same full-page pattern SharedEvaluationsPage already uses for its expired-
  share state), title "Page not found", a "Back to dashboard" link to / -> go with recommendation
## Out of scope
- A distinct message for "the server itself returned 404" (API errors) vs. an unmatched client route;
  this issue is only about client-side routes.
## Follow-ups
