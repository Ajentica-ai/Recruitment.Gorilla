<!-- phase: DONE | branch: fix/RG-259/CV-experience-gaps | tasks: 7/7
     base: d63670d | updated: 2026-11-11
     next: user decides commit + push + PR (nothing committed yet) -->
# Plan: CV experience estimate across gaps (RG-259)
## Tasks
- [x] 1. Repro first: xUnit cases in CVParserServiceTests, one per layout in the issue table, plus gap, year-only pair, numeric/`to` formats, 5-role long section, last role without title line. Confirm they fail on develop.
- [x] 2. ParseExperienceLines: bind a date line to the adjacent role (not the next), keep a trailing dated role, never default to "Software Engineer"/"Company"; read the experience section up to the next heading (drop the 25-line cap).
- [x] 3. Date parsing: support MM/YYYY, YYYY-MM, Mon 'YY, to/until, Present|Current|Now|Ongoing|Till date|To date; year-only = mid-year to mid-year. Add nullable StartMonth/EndMonth to ParsedExperience + CandidateExperienceDto (draft JSON, no migration).
- [x] 4. EstimateRelevantExperience: merge intervals from structured months (fallback: parse Duration text), gaps = 0; add "2-3 Years" (edges <12/<24/<36/<60/<96). Update server ExperiencePresets + client EXPERIENCE_PRESETS.
- [x] 5. New POST /api/candidate-drafts/estimate-experience ([Authorize]) returning the bucket for a role list; integration + auth-gate tests.
- [x] 6. DraftReviewWorkspace: call the endpoint on role add/remove/edit; auto-update Relevant Experience only while it equals the previous estimate (manual pick sticks). api.ts + types + Vitest.
- [x] 7. Docs (ai-docs/backend.md and any API/frontend doc touched); run `dotnet test`, `npm test`, `npx tsc -b`; exercise the review workspace in the running app once.
## Tests
- Standard tier (parsing logic, new endpoint, UI behavior). Full backend + frontend suites, not just new tests.
## Files
- server: Services/CVParserService.cs, Services/CandidateImportService.cs, Services/CandidateDraftService.cs, DTOs/CandidateDtos.cs, Controllers/CandidateDraftsController.cs; tests: CVParserServiceTests.cs, CandidateDraftServiceTests.cs (+ auth gate)
- client: components/drafts/DraftReviewWorkspace.tsx (+ .test.tsx), services/api.ts, types/index.ts
- docs: ai-docs/backend.md
## Risks to check in CONSTRUCT
- Approval/import validation may require non-empty jobTitle/company; empty roles must stay editable, not block or crash approval.
