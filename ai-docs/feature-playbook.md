# Feature Playbook

The canonical recipe to add a feature **in this project's style**. Not every feature touches every step, but follow the order and patterns. Read [conventions.md](conventions.md) first.

## 0. Spec first
Copy [spec-template.md](spec-template.md) into [`specs/`](specs/) and fill it in. See the worked example [specs/example-candidate-notes.md](specs/example-candidate-notes.md).

## Backend → Frontend order

### 1. Entity (if new data)
Add/extend a class in `Models/`. Match existing style (nullable where optional, UTC datetimes, navigation properties).

### 2. AppDbContext
Register a `DbSet<>` (if new) and add Fluent config in `OnModelCreating` (max lengths, `IsRequired`, relationships, `OnDelete(DeleteBehavior.Cascade)`, indexes, `Ignore` computed props). File: `Data/AppDbContext.cs`.

### 3. Migration
```bash
cd server/Recruitment.Gorilla.API   # stop the running API first (file lock)
dotnet ef migrations add <Name>
dotnet ef database update
```
Commit the generated migration files.

### 4. DTOs
Add `record` DTOs in `DTOs/` for request/response shapes. Never expose entities directly. Keep a draft/create/update/list/detail split where it mirrors existing patterns.

### 5. Service
Add a method on the relevant service in `Services/` (or a new service registered in `Program.cs`). All EF access lives here. Return `null`/tuples/`bool` to signal outcomes; log audit events with `ILogger`.

### 6. Controller
Add an action to the relevant controller (thin). Keep `[Authorize]` (default-deny already applies). Map service results to HTTP per [conventions.md](conventions.md) (`Ok`/`NotFound`/`Conflict`/`NoContent`/`BadRequest`). Log the action.

### 7. Frontend types
Add/extend interfaces in `client/src/types/index.ts` to mirror the DTOs. **Watch JSON camelCase** (`CVFiles` → `cvFiles`).

### 8. API function
Add one typed function per endpoint in `client/src/services/api.ts` using the shared `api` instance (auth handled by interceptors). For downloads, fetch a blob (see `downloadCvFile`).

### 9. Query/Mutation + UI
- Reads: `useQuery` with a sensible array key.
- Writes: `useMutation`; invalidate the affected keys on success.
- Build the page/component in `pages/`/`components/` with Tailwind utilities and shadcn/Radix primitives (`components/ui/`), following the existing component patterns; keep it theme-consistent (no hardcoded colors). Add confirm modals for destructive actions.

### 10. Tests
Add/extend tests for the behavior you changed (patterns in [conventions.md](conventions.md#testing); how to run in [dev-setup.md](dev-setup.md#4b-run-the-tests)):
- **Service test** (`server/Recruitment.Gorilla.Tests`) for new business rules — access scoping, status transitions, validation gates. Derive from `Infrastructure/DbTestBase` and build rows with `Infrastructure/TestData`.
- **Controller-auth integration test** (`ControllerAuthorizationTests`, `WebApplicationFactory`) **whenever you add or change an `[Authorize(Roles = …)]` gate** — assert the status code per role (the service tests bypass the attribute).
- **Frontend test** (Vitest) for pure logic (`utils/*`) or a validation/gating component — render via `test/renderWithProviders` and mock `services/api` (no network).

### 11. Verify (see below) and update docs
Update any affected file in `ai-docs/` (e.g. add the new endpoint to [backend.md](backend.md), new entity to [data-model.md](data-model.md)).

## Verification checklist
- [ ] `dotnet build` (API stopped first) — 0 errors.
- [ ] Migration applies cleanly (`dotnet ef database update`).
- [ ] `npx tsc -b` in `client` — 0 errors.
- [ ] `dotnet test` (in `server`, local MySQL running) — all green.
- [ ] `npm test` (in `client`, Vitest) — all green.
- [ ] Manual/HTTP test **through the proxy** (`http://localhost:5173/api/...`): unauthorized → 401; authorized happy path; not-found and validation paths.
- [ ] UI works end-to-end signed in as admin; lists refresh after writes; destructive actions confirm.
- [ ] Audit log lines appear in `Logs/recruitment-gorilla.log`.
- [ ] Docs in `ai-docs/` updated.

## Worked trace — "Delete candidate" (already in the codebase)
A concrete map of the recipe to real files:
- **Service**: `CandidateService.DeleteAsync(int id, int? ownerUserId = null)` — loads candidate + CVFiles, deletes physical files from `Uploads/`, removes the entity (CVFiles/StatusHistories cascade), returns `bool` (owner-scoped; `null` = no restriction).
- **Controller**: `CandidatesController.Delete` — `DELETE /api/candidates/{id}`, gated **`[Authorize(Roles = Roles.AdminOrAbove)]`** (Admin/SuperAdmin only — Recruiters can't delete) → `NoContent()` or `NotFound()`, logs the deletion. Guarded by `ControllerAuthorizationTests`.
- **API**: `deleteCandidate(id)` in `services/api.ts`.
- **UI**: confirm modal + `useMutation` on both `CandidateDetailPage` and each `CandidatesPage` row; invalidates `['candidates']`.
No new entity/migration/DTO were needed — steps 1–4 were skipped, which is fine.

## Common gotchas
- **File lock**: stop the running API before `dotnet build` / migrations.
- **camelCase JSON**: confirm the real serialized key before using it in TS.
- **Auth on downloads**: use a blob fetch, not `<a href>`.
- **Don't expose the backend**: keep `baseURL = '/api'` and the backend on localhost.
- **Secrets**: never add keys/passwords/connection strings to `appsettings.json` or commits.
