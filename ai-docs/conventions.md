# Conventions

Match these patterns. Consistency is the point — prefer the existing approach over a "better" new one.

## Backend (ASP.NET Core, C#)

### Layering: Controller → Service → AppDbContext
- **Controllers** are thin: validate/shape input, call a service, map to an HTTP result. No EF queries or business logic in controllers. See `Controllers/CandidatesController.cs`.
- **Services** hold business logic and own all EF Core access via `AppDbContext`. See `Services/CandidateService.cs`, `AuthService.cs`.
- **AppDbContext** (`Data/AppDbContext.cs`) declares `DbSet<>`s and Fluent config in `OnModelCreating` (max lengths, required, relationships, cascade).

### Style
- **Primary constructors** for DI: `public class CandidateService(AppDbContext db, IWebHostEnvironment env)`. Controllers too: `public class CandidatesController(CandidateService candidateService, ILogger<CandidatesController> logger)`.
- **DTOs are `record` types** in `DTOs/` — never expose EF entities directly. Separate DTOs per use: e.g. `CreateCandidateDto`, `UpdateCandidateDto`, `CandidateListItemDto`, `CandidateDetailDto`, `CVDraftDto`, `StatusChangeDto`, `AuthResultDto`.
- **Async all the way**: `await ...Async()` EF methods; controllers return `async Task<IActionResult>`.
- **Service return signals** instead of throwing for expected cases: return `null` for not-found, tuples/records for richer outcomes. Examples: `CreateAsync` returns `(CandidateDetailDto? Created, CandidateListItemDto? Duplicate)`; `DeleteAsync` returns `bool`. Controllers translate these to `NotFound()`, `Conflict(...)`, etc.
- **Logging**: inject `ILogger<T>`; log meaningful audit events on writes (create, duplicate, status change, delete, login). Use structured templates: `logger.LogInformation("Created candidate {Id} ('{Name}') by {ChangedBy}.", ...)`. Framework noise is quieted in `log4net.config`.
- **Auth**: data controllers carry `[Authorize]`; auth endpoints carry `[AllowAnonymous]`. There is also a **default-deny fallback policy** (see [auth.md](auth.md)), so new controllers are protected unless you opt out.

### HTTP result conventions
| Situation | Result |
|---|---|
| Created | `CreatedAtAction(nameof(GetById), new { id }, dto)` |
| Found | `Ok(dto)` |
| Not found | `NotFound()` |
| Validation/bad input | `BadRequest("message")` |
| Duplicate (warn-but-allow) | `Conflict(dto)` |
| Deleted | `NoContent()` |
| Unauthorized | `Unauthorized(new { message })` |

### Person names go through one shared validator
Every field holding a human name (the user `Name`, the candidate `FullName`, the
reference name) is validated by `Services/PersonNameValidator.cs` on the server
and `client/src/utils/personName.ts` on the client. The two are mirrors: change
one and change the other, and keep their test tables in step
(`PersonNameValidatorTests.cs` / `personName.test.ts`).

The rule: required, at most 100 characters, at least one Unicode letter
(`\p{L}`), and no `\p{S}` or `\p{C}` characters. `\p{S}` is where emoji and
pictographs live; `\p{C}` catches control characters and the zero-width joiners
that glue emoji sequences together. It stays permissive about script and
punctuation on purpose, so `Anne-Marie O'Neill` and non-Latin names still save.
Added for issue #38, where emoji could be saved as a user's name.

The client check only buys an immediate message. The server is the authority,
and every write path (`UserService`, `CandidateService.ValidateCandidateAsync`,
`CandidateDraftService.ApproveDraftAsync`) calls it.

## Frontend (React + TypeScript)

### Data flow: types → api.ts → TanStack Query → component
- **`types/index.ts`** holds shared interfaces mirroring the API DTOs. Keep names/shapes in sync with the backend DTOs.
- **`services/api.ts`** is the only place that talks HTTP. One exported function per endpoint, fully typed; components never call Axios directly. The Axios instance has `baseURL = '/api'`, `withCredentials: true`, and auth interceptors.
- **TanStack Query** for server state:
  - Reads use `useQuery` with array keys: `['candidates', { search, status, page }]`, `['candidate', id]`.
  - Writes use `useMutation` and **invalidate** the relevant keys on success: `queryClient.invalidateQueries({ queryKey: ['candidates'] })`.
- **Components/pages** use react-bootstrap; no bespoke CSS frameworks. Pages live in `pages/`, reusable pieces in `components/`.

### ⚠️ JSON camelCase gotcha (important)
ASP.NET serializes with camelCase, and it lowercases **runs of leading capitals**. So C# `CVFiles` becomes JSON **`cvFiles`** (not `cVFiles`). Always match the real serialized name in `types/index.ts` and component code. When in doubt, check the actual response. (This caused a real crash — `data.cvFiles` was undefined.)

### ⚠️ Dates are UTC in the DB, local in the UI
**Store UTC, render local.** Every `DateTime` column is MySQL `datetime(6)`, which stores **no offset** — so the "this is UTC" fact lives in convention, not in the data.

- **Writing:** always `DateTime.UtcNow` server-side (never `DateTime.Now`); the client sends `new Date(x).toISOString()` so a `datetime-local` input is converted from the user's zone before it leaves the browser.
- **Reading:** [UtcDateTimeConverter](server/Recruitment.Gorilla.API/Data/UtcDateTimeConverter.cs) is applied to every `DateTime`/`DateTime?` via `AppDbContext.ConfigureConventions`, re-marking values as `Kind=Utc`. Without it they materialize as `Unspecified`, serialize **without a trailing `Z`**, and browsers parse that as *local* — silently shifting every displayed time by the viewer's offset.
- **Displaying:** just use `toLocaleString()`; it converts to the viewer's zone automatically once the payload carries `Z`. Add `timeZoneName: 'short'` where cross-timezone ambiguity matters (interview times).
- **Emails** cannot detect the recipient's zone — format with `CultureInfo.InvariantCulture` and label the result `UTC` explicitly.
- **Gotcha:** the converter stops EF translating member access on a date column, so `.GroupBy(c => c.CreatedAt.Date)` throws *"could not be translated"*. Project the column out and group in memory — see `DashboardService.GetApplicationsTrendAsync`.

Guarded by `UtcDateTimeTests` (the `Kind` on read) and `DateSerializationTests` (the `Z` on the wire).

### Theme
- The Microsoft **Fluent** theme lives in `client/src/index.css` as CSS variables mapped onto Bootstrap's variables (`--ms-primary: #0078d4`, neutrals, depth shadows, Segoe UI). Use existing Bootstrap classes/components; they pick up the theme. Don't hardcode colors — reference the look already established (primary blue, 4px/8px radii, subtle shadows).
- Brand logo: `client/public/logo.png`, shown via `.app-logo-img`.

## File references in docs/PRs
Use clickable relative markdown links, e.g. `[CandidateService.cs](server/Recruitment.Gorilla.API/Services/CandidateService.cs)`, not bare backticks.

## Testing
- Tests live in `server/Recruitment.Gorilla.Tests` (xUnit), run via `dotnet test` — see [dev-setup.md](dev-setup.md#4b-run-the-tests).
- They are **service-layer integration tests against real MySQL** (a throwaway `RG_Test_*` DB), so they exercise the actual EF Core/Pomelo query translation — no in-memory fake.
- Pattern: derive a DB test class from `Infrastructure/DbTestBase` (joins the `mysql` collection → one migrated DB per run, a transaction rolled back per test for isolation); build rows with `Infrastructure/TestData` (`AddUser`/`AddRole`/`AddCandidate`/`AddInterview`/`AddSubmittedEvaluation`); assert with plain xUnit `Assert` (no FluentAssertions).
- Focus new tests on **business rules** (access scoping, status transitions, validation gates), not framework plumbing.
- **Controller-level authorization** (the `[Authorize(Roles = …)]` attributes) is tested via `WebApplicationFactory<Program>` integration tests (`Infrastructure/ApiFactory.cs` + `ApiFixture.cs`): the real API boots against a throwaway MySQL DB seeded with one user per role; tests log in for a real JWT and assert **status codes** (`Infrastructure/ApiFixture` derives the throwaway connection like the unit fixture; config is injected via env vars because Program reads it at startup). `AuthService`/`PasswordHasher` have their own tests.
- **Frontend** tests use **Vitest + Testing Library** (jsdom), run via `npm test` in `client`. Test files sit next to their source as `*.test.ts(x)`; setup is `client/src/test/setup.ts`. Cover **pure logic** (`utils/*`), **derived behavior** (e.g. `AuthContext` role flags), and **logic-heavy components** (validation gates, conditional rendering) — for the latter, render via `test/renderWithProviders` (Query + Toast + Router) and **mock `services/api`** with `vi.mock` (no network). Skip snapshots and testing that react-bootstrap/recharts render. A **read-only Playwright E2E smoke** lives in `client/e2e/` (`npm run e2e`), runs against the live dev stack with env-var credentials (`E2E_EMAIL`/`E2E_PASSWORD`), and skips when unset — it creates nothing.

## Git
- Commit only when asked; branch off the default branch first if needed.
- **Never** add Claude/Anthropic or any AI as author/co-author.
- Keep commits logically scoped (one feature/fix per commit) with a descriptive body.
