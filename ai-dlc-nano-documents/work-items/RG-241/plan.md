<!-- phase: DONE | branch: fix/RG-241/Datepicker-test-timeout | tasks: 2/2
     base: 10167fd | updated: 2026-11-02
     next: user decides push + PR -->
# Plan: raise date-picker test timeout
## Tasks
- [x] In `date-picker.test.tsx`: raise timeout arg on both `it()` calls from 15000 to 30000.
- [x] Update the doc comment to note the timeout was raised for full-suite CPU saturation.
## Tests
- Trivial tier: ran `npx vitest run date-picker.test.tsx` — 2 passed in 4.2 s.
## Files
- client/src/components/ui/date-picker.test.tsx
