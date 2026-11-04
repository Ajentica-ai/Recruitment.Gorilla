<!-- phase: DONE | branch: fix/RG-243/Toast-uuid-ids | tasks: 2/2
     base: 7151575 | updated: 2026-11-02
     next: user decides push + PR -->
# Plan: fix toast id collisions
## Tasks
- [x] `ToastStack.tsx`: change `ToastItem.id` from `number` to `string`; change `remove` param
      to `string`; replace `const id = Date.now()` with `const id = crypto.randomUUID()`.
- [x] New `ToastStack.test.tsx`: call `addToast` twice synchronously, assert both messages render;
      click one dismiss button, assert only that toast disappears.
## Tests
- Standard tier: 2 new tests pass; full suite 393/393 green.
## Files
- client/src/components/ToastStack.tsx
- client/src/components/ToastStack.test.tsx  (new)
