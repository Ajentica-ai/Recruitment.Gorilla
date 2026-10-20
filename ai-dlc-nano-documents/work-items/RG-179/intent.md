# E2E suite grows the shared dev database every run
- Source: issue #179 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/179 (labels bug, AI-initiated)
- Type: bug (test infrastructure)
## Request
- bulk-upload-10-cvs, json-import and education-experience-profiles create drafts/candidates and never remove them (pending drafts 65 -> 232 in a few runs).
## Decisions
- Per-test cleanup that records the ids each test creates from its own network responses (a snapshot diff failed: Playwright runs spec files in parallel) (user approved the per-spec approach).
- Delete candidates first, then discard + permanently delete drafts (API only deletes Discarded drafts).
## Out of scope
- offer-management / kanban specs mutate existing candidates (not growth): backlog.
## Follow-ups
