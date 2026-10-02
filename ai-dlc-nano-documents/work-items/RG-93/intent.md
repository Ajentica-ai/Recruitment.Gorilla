# Block re-uploading the same CV
- Source: issue #93 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/93
- Type: feature (label `enhancement`)
## Request
- `POST /api/cvupload` accepts a CV already in the system, creating a second draft and, on approval, a duplicate candidate.
- Reject identical content (not filename) with 409 before writing to disk or parsing.
- Upload page shows duplicates separately from parse failures.
## Decisions (confirmed by user 2026-10-02)
- Match on SHA-256 of file content; a renamed copy is still a duplicate.
- Blocks when the twin is in a Pending draft or attached to a candidate; Discarded drafts and deleted candidates free it.
- Check is global across recruiters; message names no candidate (no cross-owner leak).
- Legacy rows (no hash) are hashed from disk on demand when a same-size upload arrives, then saved.
- No DB unique constraint (hash spans two tables); a simultaneous double upload may slip through, accepted.
## Out of scope
- Detecting near-duplicates (same person, different file) - the existing duplicate-email 409 covers that at save.
## Follow-ups
- none yet
