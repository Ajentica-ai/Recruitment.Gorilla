<!-- phase: WRAP-UP | branch: feature/RG-244/Clear-warnings | tasks: 11/11
     base: 54c38dd | updated: 2026-11-02
     next: commit + push + PR -->
# Plan: clear build, lint and runtime warnings
## Tasks
### Backend compiler
- [x] CS8604: EvaluationSharesController.cs:53,68 — pass `currentUser.Name ?? string.Empty`
- [x] CS8601: CandidateDraftService.cs:435 — use null-forgiving `fullName!` (guard above proves non-null)
- [x] CS9113: remove `ILogger<OffersController> logger` param from OffersController ctor
- [x] CS9113: remove `ILogger<OfferService> logger` param from OfferService ctor; fix DbTestBase.cs too
- [x] xUnit1031: OfferStateMachineTests.cs:443-448 — store `await edit` and `await extend` after WhenAll
- [x] CS8602: OfferStateMachineTests.cs:214 — add `Assert.NotNull(newVersion)` before access
- [x] CS0108: AuditServiceTests.cs — rename local `Audit()` to `MakeAudit()`, update call sites
### Client lint
- [x] react/only-export-components: add eslint-disable-next-line comment above grouped exports
       in alert.tsx:52, badge.tsx:62, button.tsx:87
### EF runtime
- [x] QuerySplittingBehavior: add `.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)`
       to `AddDbContext` in Program.cs
- [x] FirstOrDefault without OrderBy: CandidateService.cs:543 — add `.OrderBy(d => d.Id)`
       (the 3 runtime warnings are this same query running once per uploaded CV in the E2E run)
### React DOM
- [x] GuideMarkdown.tsx — add custom `p` renderer that skips `<p>` when sole child is `img` element
## Tests
- Standard tier: run `dotnet build` (zero warnings), `npm run lint` (zero warnings).
- Full Vitest and xUnit suites must stay green.
- No new test needed: these are warning fixes, not behavior changes.
## Files
- server/Recruitment.Gorilla.API/Controllers/EvaluationSharesController.cs
- server/Recruitment.Gorilla.API/Services/CandidateDraftService.cs
- server/Recruitment.Gorilla.API/Controllers/OffersController.cs
- server/Recruitment.Gorilla.API/Services/OfferService.cs
- server/Recruitment.Gorilla.Tests/OfferStateMachineTests.cs
- server/Recruitment.Gorilla.Tests/AuditServiceTests.cs
- client/src/components/ui/alert.tsx
- client/src/components/ui/badge.tsx
- client/src/components/ui/button.tsx
- server/Recruitment.Gorilla.API/Program.cs
- server/Recruitment.Gorilla.API/Services/CandidateService.cs (+ possibly 2 more)
- client/src/components/userGuide/GuideMarkdown.tsx
