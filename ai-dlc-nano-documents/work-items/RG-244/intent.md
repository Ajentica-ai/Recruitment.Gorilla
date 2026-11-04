# Clear build, lint and runtime warnings (RG-244)
- Source: issue #244 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/244
- Type: improvement
## Request
- Backend: CS8604 (null args to CreateAsync/RevokeAsync), CS8601 (null assignment to FullName),
  CS9113 (unused logger in OffersController + OfferService), xUnit1031 (3x .Result in async test),
  CS8602 (newVersion null deref in test), CS0108 (Audit() hides DbTestBase.Audit())
- Client lint: react-refresh/only-export-components x3 in alert.tsx, badge.tsx, button.tsx
- EF runtime: missing default QuerySplittingBehavior; 3x FirstOrDefault on CV upload path without OrderBy
- React DOM: figure rendered inside p in GuideMarkdown (react-markdown img custom renderer)
## Decisions
- CS8604: pass `currentUser.Name ?? string.Empty` (Name is string? by design; service callers already do this)
- CS9113: remove the `logger` param from OffersController and OfferService constructors entirely
- CS0108: rename `Audit()` helper in AuditServiceTests to `MakeAudit()` and update call sites
- React lint: add eslint-disable-next-line comment before the grouped export lines (established pattern)
- QuerySplittingBehavior: set default SplitQuery in Program.cs AddDbContext call
- figure-in-p: add custom p renderer that unwraps when sole child is img
## Out of scope
- Fixing the underlying nullability of the candidate model (FullName, Email fields)
- Adding logging to OffersController/OfferService where it was unused
