# Toast ids: replace Date.now() with crypto.randomUUID()
- Source: issue #243 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/243
- Type: bug
## Request
- `ToastStack.tsx` uses `Date.now()` as toast id / React key; two toasts in the same ms share
  an id, producing duplicate keys and potentially dropping one toast
- Visible in dev (StrictMode runs effects twice); in prod needs two toasts in the same ms
- Fix: use `crypto.randomUUID()` for the id (available in all modern browsers + jsdom)
## Decisions
- Use `crypto.randomUUID()`: collision-free, no module import, standard in all target envs
- Change `ToastItem.id` type from `number` to `string`; update `remove` param accordingly
- Add Vitest test: two toasts in the same tick both render and dismiss independently
## Out of scope
- Auto-dismiss timing, toast animations, variant styles
