<!-- phase: DONE | branch: fix/RG-261/Toast-dark-mode-background | tasks: 5/5
     base: d63670d | updated: 2026-11-17
     next: none -->
# Plan: Opaque toast background (#261)
## Tasks
- [x] Failing Vitest first: each variant has the opaque toast class (+ left accent bar class)
- [x] ToastStack.tsx: opaque base (surface) under the tint, accent bar per variant
- [x] Measure text contrast for 4 variants in light and dark; adjust text tokens only if under 4.5:1
- [x] Optional (if approved): pause dismiss on hover/focus, longer error toast
- [x] Update ai-docs/frontend.md; full vitest, tsc, oxlint; Playwright screenshots in both themes over a table and a dialog
## Tests
- Standard tier: Vitest per variant + (optional) hover-pause with fake timers; Playwright screenshots, both themes.
## Files
- client/src/components/ToastStack.tsx, ToastStack.test.tsx, ai-docs/frontend.md (maybe styles/tokens.css)
