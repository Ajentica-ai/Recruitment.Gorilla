# Dev Setup & Run

## Prerequisites
- .NET 10 SDK
- Node.js 20+
- MySQL 8+ (running on `localhost:3306`)
- `dotnet-ef` CLI **9.0.0**: `dotnet tool install --global dotnet-ef --version 9.0.0`

## 1. Secrets (per machine, not committed)
All three live in **.NET user secrets** for the API project.
```bash
cd server/Recruitment.Gorilla.API

# DB connection
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Port=3306;Database=RecruitmentGorilla;User=root;Password=<yours>;"

# JWT signing key (must be >= 32 bytes)
dotnet user-secrets set "Jwt:Key" "<random base64 key>"

# Admin password hash (default login admin/admin)
dotnet user-secrets set "Auth:PasswordHash" "<pbkdf2 hash>"

# Encryption root key — REQUIRED (app fails to start without it). Encrypts secrets stored at
# rest (the in-app SMTP password). Must be STABLE across restarts/containers, else stored
# ciphertext becomes undecryptable. 32+ random chars.
dotnet user-secrets set "Encryption:Key" "<random base64 key>"

# Outbound email — OPTIONAL fallback. SMTP is normally configured in-app (Configuration →
# Email / SMTP, SuperAdmin) and stored encrypted in the DB. These user-secrets/config values
# are only used as a fallback when no DB row exists (or it's disabled). If neither is set,
# EmailService logs a warning and skips sending (never breaks the underlying operation).
dotnet user-secrets set "Smtp:User" "notifications@yourdomain.com"
dotnet user-secrets set "Smtp:Password" "<16-char app password>"
dotnet user-secrets set "Smtp:FromAddress" "notifications@yourdomain.com"
```
**SMTP is configured in-app** by a SuperAdmin at **Configuration → Email / SMTP** (host, port,
username, password, from-address, STARTTLS, enabled) with a **Send test email** button; the password
is encrypted at rest (`SecretProtector`, AES-GCM keyed by `Encryption:Key`) and never returned to the
client. The `Smtp:*` config/`appsettings` values (`Smtp:Host`/`Smtp:Port`/`Smtp:FromName` default to
`smtp.gmail.com`/`587`/`Recruitment Gorilla`) are a **fallback** only. Gmail/Workspace app passwords
require 2-Step Verification; `App:ClientBaseUrl` (default `http://localhost:5173`) builds absolute
links in emails — set it to your real frontend origin in other environments. In Docker, provide
`Encryption__Key` (and any fallback `Smtp__*`) as environment variables.

### Generate a JWT key + password hash (PowerShell)
```powershell
# Random signing key
$k = New-Object byte[] 64; [Security.Cryptography.RandomNumberGenerator]::Fill($k)
[Convert]::ToBase64String($k)

# PBKDF2-HMAC-SHA256 hash, format "iterations.saltB64.hashB64"
$pass = "admin"
$salt = New-Object byte[] 16; [Security.Cryptography.RandomNumberGenerator]::Fill($salt)
$iter = 100000
$pb = New-Object Security.Cryptography.Rfc2898DeriveBytes($pass,$salt,$iter,[Security.Cryptography.HashAlgorithmName]::SHA256)
"$iter.$([Convert]::ToBase64String($salt)).$([Convert]::ToBase64String($pb.GetBytes(32)))"
```
The hash format and algorithm must match `AuthService.VerifyPassword` (PBKDF2-SHA256, 32-byte key). To change the admin password, regenerate with a new `$pass` and update the secret.

## 2. Database
```bash
cd server/Recruitment.Gorilla.API
dotnet ef database update     # creates the DB + tables if needed
```

## 3. Run (two terminals)
```bash
# Backend — localhost only (do NOT bind 0.0.0.0)
cd server/Recruitment.Gorilla.API
$env:ASPNETCORE_ENVIRONMENT="Development"      # loads user secrets, enables Swagger
dotnet run --urls http://localhost:5000

# Frontend
cd client
npm install
npm run dev                                    # http://localhost:5173
```
Login: **admin / admin**. Swagger: `http://localhost:5000/swagger`.

## 4. Verify a change
```bash
# Backend (stop the running API first — it locks the exe)
cd server/Recruitment.Gorilla.API && dotnet build

# Frontend typecheck
cd client && npx tsc -b
```
Smoke-test through the proxy: `http://localhost:5173/api/...` should behave like the API (401 without a token, 200 after login).

## 4b. Run the tests
```bash
# Backend (service-layer, real MySQL)
cd server && dotnet test          # runs Recruitment.Gorilla.Tests

# Frontend (Vitest: pure utils + auth derivation)
cd client && npm test             # vitest run  (npm run test:watch to watch)
```
**Frontend tests** (Vitest + Testing Library, jsdom) cover pure logic (`utils/*`), `AuthContext`
role-derivation flags, and logic-heavy components (`StatusTimeline`, `EvaluationForm` submit gate,
`CandidateForm` validation/auto-select) — no network (the API module is mocked via `vi.mock`). Fast,
no MySQL needed. **Backend tests** = service-layer unit tests + **`WebApplicationFactory` integration
tests** (real HTTP pipeline + JWT auth, asserting the `[Authorize]` attributes per role) + `AuthService`
/ `PasswordHasher`:
- **Require the local MySQL server running** (the tests use real MySQL/Pomelo, not an in-memory fake).
- Each run creates **throwaway databases** (`RG_Test_{guid}` for unit, `RG_ITest_{guid}` for the booted
  API), migrates them (schema + seed), runs, then **drops** them — the real `RecruitmentGorilla`
  database is never touched.
- The connection comes from the env var **`RG_TEST_MYSQL`** if set, otherwise the API's **user-secrets**
  `ConnectionStrings:DefaultConnection` (the test project shares the API's `UserSecretsId`); only the
  database name is swapped. No credential is committed.
- Isolation/pattern: one migrated DB per run (xUnit collection fixture, classes run sequentially) +
  a **transaction rolled back per test** (unit) or committed-then-dropped (integration). Data builders
  live in `Recruitment.Gorilla.Tests/Infrastructure/` (`TestData.cs`, `ApiFixture.cs`).

### E2E suite (Playwright)
```bash
# 1. Start the dev stack (API :5000 + client :5173) as in §3.
# 2. One-time browser download:
cd client && npx playwright install chromium
# 3. Fill in credentials: copy e2e/.env.e2e.example to e2e/.env.e2e.
# 4. Run everything:
npm run e2e
```
Runs against the **live dev stack**. Credentials come from `e2e/.env.e2e`, which is gitignored:
real environment variables still win, so CI can inject them. Specs live in `client/e2e/`; Vitest
ignores them (it only scans `src/`).

**A spec either passes or skips with a reason** (issue #83). Skips are expected and say what is
missing, which is why a red run means something real:

| Spec | Skips when |
|---|---|
| `smoke`, `dialog-footer-visible`, `drawer-*`, `rubric-editor-layout` | credentials are unset |
| `analytics-and-upload`, `offer-management` | the signed-in user can see no candidates |
| `responsive-card-header` | the dashboard has no cards; its interview leg also needs an interview the account is **assigned to** (not merely able to view), which it checks via `canEvaluate` |
| `screenshot-interview` | `E2E_INTERVIEW_ID` is unset |
| `compose` | nothing answers on `COMPOSE_BASE_URL` (it tests the Docker stack, not Vite) |

Credentials worth knowing: `E2E_EMAIL` is a **Recruiter**, so candidate access is role-scoped and
several specs skip for that account alone. The upload specs need `E2E_ADMIN_EMAIL`, because
approving a draft means assigning an applied role and a Recruiter only sees roles assigned to them.

**CV fixtures are generated, not committed, and never reused.** The PDFs carry invented people
with `.invalid` emails. `e2e/make-test-cvs.mjs` writes them by hand rather than pulling in a PDF
library, and the filenames matter: `CVParserService.ParseNameAndTitleFromFileName` reads
`First-Last-Title-Words.pdf`, so a numeric prefix would be parsed as the first name.

Since #93 the API refuses a CV whose bytes it already holds, matched by content hash against pending
drafts **and every approved candidate's CV**, which never goes away. So the upload specs call
`freshTestCvs()`, which writes a new set under `client/test-results/cvs/<uuid>/` with that UUID as a
salt in a PDF comment. The comment changes every file's hash and none of the text the parser reads, so
no two runs, and no two specs in one run, ever upload the same bytes. `npm run e2e:cvs` still writes an
unsalted set into `e2e/test-cvs/` for poking at by hand; the specs do not use it.

Screenshots go under `client/test-results/screenshots` (gitignored); set `E2E_SHOT_DIR` to collect
them elsewhere.

**The upload specs write data** and do not clean it up: each run leaves drafts, and the approve
steps create candidates. Fine on a local dev database, worth knowing before pointing them anywhere
that matters.

## 5. LAN access (frontend only)
Other PCs on the network use the **frontend only**; the backend stays private behind the proxy.
- Vite is exposed via `server.host: true` in `vite.config.ts` (or `npm run dev -- --host`). It prints a `Network:` URL like `http://<your-ip>:5173`.
- The browser calls same-origin `/api`, which Vite proxies to `localhost:5000` — so **only port 5173** needs to be open.
- Windows firewall (admin), works on a Public network too:
  ```powershell
  New-NetFirewallRule -DisplayName "RecruitmentGorilla Web 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Any
  ```
- Add the LAN origin to `AllowedOrigins` in `appsettings.json` only if you bypass the proxy (normally not needed).

## Notes / gotchas
- **Stop the API before building or running migrations** (file lock on the exe).
- User secrets only load in the **Development** environment — run with `ASPNETCORE_ENVIRONMENT=Development`.
- Logs: `server/Recruitment.Gorilla.API/Logs/recruitment-gorilla.log` (+ console).
- Uploaded files: `server/Recruitment.Gorilla.API/Uploads/` (gitignored).
