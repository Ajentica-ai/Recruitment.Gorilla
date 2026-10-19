# E2E responsive-card-header interview test silently skips (races the render)
- Source: issue #178 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/178 (labels bug, AI-initiated)
- Type: bug (test only)
## Request
- The chip test checks .interview-chip isVisible() right after goto, before React renders; requireData turns the false into a skip with a wrong "no data" reason. It has never asserted anything.
## Decisions
- Wait for the chip (15s) before requireData; sign in at a wide viewport first, then go to 390px; give the sibling dashboard-cards check the same wait (user approved).
## Out of scope
- App code; other specs' timing flakes (backlog).
## Follow-ups
