# Backlog
<!-- Out-of-scope findings, newest first. Delete a line when it is resolved. -->
- [2026-09-30] client/src/components/ui/label.tsx - Label has no htmlFor, so getByLabelText fails and SRs lose the tie (found: RG-38)
- [2026-09-30] server CandidateService - stores dto.FullName untrimmed while UserService trims; padded names save padded (found: RG-38)
- [2026-09-30] client/e2e - seeded admin@recruitmentgorilla.com is named 'Super Admin' but holds only the Admin role (found: RG-38)
- [2026-09-30] client/src/index.css - `.required-star` defined twice, identical, at :125 and :1105 (found: RG-36)
- [2026-09-30] docs/PROJECT_PLAN.md - never refreshed to describe develop as final (found: 001-brand-branch-triage)
