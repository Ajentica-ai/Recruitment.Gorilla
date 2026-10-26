# E2E eval actions spacing test fails on sub-pixel jitter
- Source: issue #177 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/177 (labels bug, AI-initiated)
- Type: bug (test only)
## Request
- e2e/eval-actions-spacing.spec.ts asserts the buttons' top edges agree within 0.5px; sub-pixel layout makes it fail under full-suite load (1.48px seen) while the buttons are identical.
## Decisions
- Compare the vertical centres within 2px AND read both rects in one page.evaluate (two boundingBox calls are two moments; a 2.6px shift between them still failed 2 of 80 runs) (user approved the centre check).
## Out of scope
- App code and styling: nothing is misaligned.
## Follow-ups
