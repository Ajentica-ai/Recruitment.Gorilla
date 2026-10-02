# Backlog
<!-- Out-of-scope findings, newest first. Delete a line when it is resolved. -->
- [2026-10-02] CVUploadController - duplicate check has no DB constraint; simultaneous identical uploads both pass (found: RG-93)
- [2026-10-02] CVParserService - education institution truncates to one word ("University") from a full name (found: RG-83)
- [2026-10-02] client/e2e - the upload specs create drafts and candidates every run and never clean up (found: RG-83)
- [2026-09-30] client/src/index.css - .eval-progress__count is nowrap, pinning the eval header actions at 281px (found: RG-72)
- [2026-09-30] client/src/components/ui/label.tsx - Label has no htmlFor, so getByLabelText fails and SRs lose the tie (found: RG-38)
- [2026-09-30] server CandidateService - stores dto.FullName untrimmed while UserService trims; padded names save padded (found: RG-38)
- [2026-09-30] client/e2e - seeded admin@recruitmentgorilla.com is named 'Super Admin' but holds only the Admin role (found: RG-38)
- [2026-09-30] docs/PROJECT_PLAN.md - never refreshed to describe develop as final (found: 001-brand-branch-triage)
