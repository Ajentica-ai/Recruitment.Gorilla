<!-- phase: DONE | branch: feature/RG-54/Job-opening-option-lists | tasks: 8/8
     base: 0fe3157 | updated: 2026-10-13
     next: none -->
# Plan: admin-managed Location / Department / Priority lists (HIGH blast radius: migration, validation, rename cascade)
## Tasks
- [x] Model JobOpeningOption (Kind, Name, SortOrder, IsActive, timestamps; unique Kind+Name) + AppDbContext + migration seeding today's values
- [x] DTOs + ConfigurationService: list / create / update / delete-or-deactivate; rename cascades to RoleAppliedOptions in one transaction
- [x] Replace JobOpeningOptions allowlist in ValidateRole: value must be an active option of its kind (current value of an edited opening still allowed)
- [x] ConfigurationController: /api/config/job-opening-options (Admin+), audit rows like Skills
- [x] Client: api.ts + types; "Job opening fields" tab (3x OptionChipsTab); JobOpeningsTab form reads the lists
- [x] Backend tests: CRUD, duplicate, rename cascade, in-use delete -> deactivate, validation, [Authorize] gate (Recruiter 403)
- [x] Frontend tests; full dotnet test + npm test + tsc + lint; check Down() works
- [ ] Browser check in Edge; update ai-docs (data-model, backend, frontend)
## Tests
- High blast radius: failure/rollback paths covered, full suites, real browser check
## Files
- server: Models/JobOpeningOption.cs, Data/AppDbContext.cs, Migrations, DTOs, Services/ConfigurationService.cs, Controllers/ConfigurationController.cs, Tests
- client: services/api.ts, types/index.ts, pages/ConfigurationPage.tsx, pages/configuration/JobOpeningsTab.tsx (+tests), ai-docs
