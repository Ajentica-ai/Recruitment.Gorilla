# Toast messages are hard to read: dark-mode background is ~86% transparent
- Source: issue #261 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/261
- Type: bug
## Request
- Toasts use the --*-tint tokens as their fill. In dark mode those are 13-14% alpha, so content behind shows through the text.
- Give toasts an opaque base with the tint layered on top, keep border and shadow, add a left accent bar per variant.
- Check text contrast (4.5:1) for all four variants in both themes.
- Optional: pause auto-dismiss on hover/focus; keep error toasts longer.
## Decisions
- Hover/focus pause and longer error toast included -> yes (user: go with recommendation)
## Out of scope
- Badges and alerts (they sit on a known surface; their tints stay as they are).
## Follow-ups
