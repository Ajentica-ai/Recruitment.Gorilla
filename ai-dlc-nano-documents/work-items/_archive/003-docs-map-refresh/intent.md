# Refresh stale living docs and the codebase map
- Source: human request ("check the full repo and map and update the docs")
- Type: feature (docs/chore, no tracker issue)
## Request
- A full audit found the design system was renamed Prism -> Harbor in the actual CSS
  (tokens.css says so explicitly) and the UI moved react-bootstrap -> Tailwind v4 +
  shadcn/Radix, with no corresponding doc update.
- Refresh every living reference doc (AGENTS.md, ai-docs/*.md except specs/ and the
  two dated roadmaps, README.md) to match current code, plus the ai-dlc-nano map/
  tech-stack bookkeeping.
## Decisions
- Leave historical/point-in-time docs untouched: PROJECT_PLAN.md, FEATURE_IMPROVEMENT_
  ROADMAP.md, ai-docs/specs/candidate-ux-validation-config-and-preview(-prompt).md (user)
## Out of scope
- Any historical/dated document listed above.
- product-improvement-roadmap.md (checked, no stale references found).
## Follow-ups
