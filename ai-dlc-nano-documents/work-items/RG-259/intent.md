# CV parsing counts experience as continuous across gaps (RG-259)
- Source: issue #259 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/259
- Type: bug (labels: bug, backend, cv-parsing, priority: high)
## Request
- Relevant Experience on a CV draft is wrong for candidates with career gaps: dates attach to the wrong role, so the estimate is computed from the wrong spans.
- Root cause is upstream of the interval maths: `ParseExperienceLines` (CVParserService.cs ~410-484) flushes a role before its date line, drops a trailing dated role, and fabricates "Software Engineer"/"Company".
- Also: year-only ranges bridge gaps, unsupported date formats, fixed 25-line section window, bucket edges (no 2-3 band), estimate not recomputed when roles are edited in review.
## Decisions
- Buckets: add a "2-3 Years" band (edges <12, <24, <36, <60, <96) -> user confirmed (recommended)
- Recompute on review edit: server endpoint; form auto-updates only while value equals the estimate of the previous roles, so a manual choice sticks -> user confirmed (recommended)
- Structured start/end month: nullable fields in the draft ExperienceJson only, no migration -> user confirmed (recommended)
- Assumed (not asked): one PR for all 7 root causes; year-only ranges count mid-year to mid-year; missing title/company stay empty; whole section read up to next heading
## Out of scope
- In-browser extraction (#260); interval calculation stays on the server.
## Follow-ups
- Inline header split treats any hyphen as a separator, so "Full-Stack Developer - Acme (dates)" splits wrongly (pre-existing).
- Pending drafts already in the DB keep the old, wrong estimate; nothing re-estimates them on load.
- The issue's table says layout 1 is "3-5 Years" but its own 26 + 41 months is 67, which is 5-8 Years; tests assert 5-8.
- work-items/ holds 49 completed items; retention (keep last ten) was not run so this PR stays small.
