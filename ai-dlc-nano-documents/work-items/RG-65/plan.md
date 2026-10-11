<!-- phase: DONE | branch: feature/RG-65/Row-actions-menu-overlap | tasks: 1/1
     base: 69c6489 | updated: 2026-10-12
     next: none - verified across Candidates/Users, ready to commit -->
# Plan: Open the row/card actions menu upward to stop it overlapping the next card

Rigor tier: standard (shared UI component, 4 call sites, no business logic).

## Tasks
- [x] `RowActions.tsx`: add `side="top"` to its `DropdownMenuContent` call
      (keep `align="end"`). Radix's default `avoidCollisions` still flips it
      to "bottom" when there's no room above.

## Tests
- No existing test asserts dropdown placement; none needed for a one-prop
  positioning change. Verified by observation at the reported viewport
  (893x749, matches issue #65's screenshot): Candidates (first card, "near
  top" edge case) and Users - menu opens upward, no overlap with the next
  card, no clipping. Email Delivery tab has an empty dataset in this dev DB
  (no row to click) - not live-verified, but it's the same shared component
  with its own test suite (5/5 passing). `npx tsc -b`, lint, and the full
  frontend suite (221/221) all pass.

## Files
- client/src/components/common/RowActions.tsx
