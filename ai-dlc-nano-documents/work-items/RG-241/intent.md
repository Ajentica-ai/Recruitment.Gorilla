# Unit test date-picker: fix timeout under full-suite load
- Source: issue #241 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/241
- Type: bug
## Request
- `date-picker.test.tsx` > "shows the custom calendar button on a non-Firefox browser" hits 15 s
  timeout when the full Vitest suite runs; passes on its own in ~3.7 s
- Root cause: `vi.resetModules()` + dynamic import re-transforms the module graph; under CPU
  saturation from parallel test workers, this takes >15 s
- Issue suggests fake timers or narrower render first; neither applies here (no timer, no heavy
  render: slowness is the module re-transform). Raising the timeout is the correct fix.
## Decisions
- Raise per-test timeout from 15 000 ms to 30 000 ms for both tests; add a note to the comment
- Resolves backlog entry from RG-156
## Out of scope
- Restructuring isFirefox to avoid vi.resetModules() (architectural change, not needed)
