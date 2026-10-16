<!-- phase: DONE | branch: fix/RG-75/Dashboard-recommended-stale | tasks: 3/3
     base: 282f3b6 | updated: 2026-10-09
     next: none - complete, uncommitted -->
# Plan: Dashboard Recommended tile goes stale after a status change

## Tasks
- [x] `AddStatusModal.tsx`: invalidate `['dashboard']` in the status-change mutation's `onSuccess`.
- [x] `KanbanBoard.tsx`: same fix in `directTransitionMutation`'s `onSuccess`.
- [x] Tests: both covered, including the drag-and-drop path (simulated via `fireEvent.drop` on the
      column's `data-status-name` element).

## Tests (standard tier: logic bug, two call sites, no auth/data-shape change)
- `AddStatusModal.test.tsx` (new): spies on `queryClient.invalidateQueries`, submits a status
  change, asserts `['dashboard']` is invalidated alongside the pre-existing keys. 2 tests, both green.
- `KanbanBoard.test.tsx` (extended): same assertion via a simulated drag-and-drop. 1 test, green.
- `npx tsc -b` clean; `npm test` 176/176 passed; `npm run lint` clean (3 pre-existing warnings in
  unrelated files only).
- Manual browser click-through (dashboard open in one tab, change status in another, watch the
  tile update live) was not performed this session — no browser tool was invoked. The automated
  tests assert the exact TanStack Query call that drives a refetch, which is the actual mechanism,
  not a proxy for it; recommended as the user's own final sanity check before merging.

## Files
- client/src/components/AddStatusModal.tsx
- client/src/components/kanban/KanbanBoard.tsx
- client/src/components/AddStatusModal.test.tsx (new)
- client/src/components/kanban/KanbanBoard.test.tsx
- client/src/test/renderWithProviders.tsx (now also returns `queryClient`)
