# Authentication & Authorization

Multi-user, role-based accounts stored in the database. **Login is by email.** JWT access tokens + rotating refresh tokens. The backend is the real gate (not just the UI), because the API is reachable through the Vite proxy.

## Roles & permission matrix
Four roles in a strict hierarchy **SuperAdmin → Admin → Recruiter → Interviewer**; a user may hold **several** at once (`UserRole` rows, one per role). A higher role can do everything a lower one can (each policy allow-list in `Auth/Roles.cs` includes the roles above it). Constants live in `Auth/Roles.cs` (`Roles.AdminOrAbove`, `Roles.CanWriteCandidate`, `Roles.SuperAdmin`) — use them instead of string literals.

| Capability | SuperAdmin | Admin | Recruiter | Interviewer |
|---|---|---|---|---|
| Manage users & assign roles (`/api/users`) | ✅ | – | – | – |
| Configuration: roles/skills (`/api/config/*`) | ✅ | ✅ | – | – |
| **Email / SMTP settings** (`/api/config/email*`) | ✅ | – | – | – |
| **Slack settings** (`/api/config/slack*`) | ✅ | – | – | – |
| Audit trail (`/api/audit`, `/audit` page) | ✅ | ✅ | – | – |
| **Delete** a job-opening role | ✅ | – | – | – |
| View / browse candidates | all | all | **own OR assigned-role** | – |
| Create / upload candidate | ✅ | ✅ | ✅ (becomes owner, assigned roles only) | – |
| **JSON + CVs import** (`/api/candidate-import/*`) | ✅ | ✅ | – | – |
| CV **drafts**: view / edit / approve / discard / delete a discarded draft (`/api/candidate-drafts/*`) | all | all | **own uploads OR assigned-role** | – |
| Edit / change status candidate | ✅ (all) | ✅ (all) | **own OR assigned-role** (role *reassignment* needs the new role too) | – |
| **Delete** candidate | ✅ | ✅ | – | – |
| Dashboard + assigned interviews + evaluations | ✅ | ✅ | ✅ | ✅ |
| User guide (`/api/user-guide`, `/user-guide` page) — content cut to caller's role | ✅ (all 7 chapters) | ✅ (+ch.3) | ✅ (+ch.2) | ✅ (ch.0/1/5 only) |
| Candidate **evaluation report** (`/candidates/:id/evaluations`) | ✅ | ✅ | **own OR assigned-role** | – |
| Create / edit / submit / extend an **offer**, record the candidate's decision | ✅ (all) | ✅ (all) | **own OR assigned-role** | – |
| **Approve / reject** an offer (`.../offers/{id}/review`) | ✅ | ✅ | – | – |
| **Share** a candidate's submitted evaluations with a named user (`/api/candidates/{id}/evaluation-shares`, #183): list / grant / revoke / drawer options (#185) | ✅ (any candidate) | ✅ (any candidate) | **own OR assigned-role** (out of scope = 404) | – (403) |
| **View shared evaluations** (`/api/shared-evaluations`: `mine`, `candidates/{id}`, `.../profile`, `.../cv/{fileId}`, #184): only what an **active grant** covers | grant only | grant only | grant only (candidate scope ignored) | grant only |
| See **peers'** evaluations on an interview | all | all | – | **after submitting own (same interview, submitted only)** |

- **Recruiter scoping** (`CandidateService.ApplyAccess`): a non-admin caller may access a candidate when they **own** it (`OwnerUserId`) **OR** are an assigned **recruiter of that candidate's role** (`RoleAppliedOption.Recruiters`, a many-to-many). This is creator-agnostic — an Admin-created candidate under a recruiter's role is visible to that recruiter, and a role can name **multiple** recruiters (all get access). Admin+ pass `null` (no filter). Applies to list / detail / CV stream / edit / change status.
- **Filing or reassigning a candidate under a role is itself checked, not just read access to the candidate** (`CandidateService.CreateAsync`/`UpdateAsync`, issue #97): a Recruiter may only create a candidate under a role they are an assigned recruiter of, and may only *change* an existing candidate's role to one they are assigned to — editing a candidate's other fields never requires this, so a Recruiter who already has access to a candidate (owns it, or is assigned to its *current* role) isn't blocked from unrelated edits just because that role isn't theirs. Previously only the client enforced this, by offering just the Recruiter's own roles in the dropdown; a direct request could file or move a candidate under any active role. Admin+ unaffected.
- **CV drafts are scoped to their uploader, or their assigned job opening** (`CandidateDraftService.ScopedDrafts`): a non-admin sees and acts on a draft when they uploaded it themselves **or** are an assigned recruiter of its `RoleAppliedOption` — the same OR as candidate scoping (`CandidateService.ApplyAccess`), so a Recruiter can pick up and approve a draft an Admin or another Recruiter uploaded for an opening they're assigned to. Admin+ see all. Every read and write goes through the one helper, list, by-id, update, approve, discard and both bulk forms, because the list alone used to be scoped while the by-id paths loaded drafts by id, so a Recruiter could read, edit, discard or approve another user's parsed CV and so become the owner of the candidate it produced. It **fails closed**: a non-admin caller with no user id sees no drafts, where the old list check fell through to all of them. The one deliberate exception is the duplicate-CV check, which is global by design (see `data-model.md`).
- **A job opening is required to upload or import a CV** (`CandidateDraftService.ValidateJobOpeningForCallerAsync`, shared by `CVUploadController`, `CandidateImportController`, and draft update/approve): the opening must exist, be active, and not be past its `EndDate`; a Recruiter is further restricted to an opening they are assigned to (Admin+ may use any open opening). The same check keeps a Recruiter from reassigning a draft, on update or approve, to an opening they aren't assigned to.
- **JSON + CVs import is Admin+ only** (`[Authorize(Roles = Roles.AdminOrAbove)]` on `CandidateImportController`) — a Recruiter gets 403. The batch's job opening is required; an entry's own named `role`, if it doesn't resolve to an open opening, falls back to the batch's opening with a warning instead of being left blank (`CandidateImportService.ResolveRoleAsync`).
- **Who may be assigned as a recruiter**: only users in `Roles.CanWriteCandidate` (Recruiter or higher). The scoping above grants nothing to an Interviewer, since `CandidatesController` excludes the role outright — so `ConfigurationService` **rejects** the assignment and the picker reads the narrower `GET /api/config/recruiter-options` rather than the interviewer list.
- **The offer state machine (#192)** is what makes an approval bind the offer that is sent, and it is enforced in `OfferService`, not the UI. **Terms can change only on a `Draft`**; **submit for approval only from `Draft`**; **review only from `PendingApproval`** and **record the candidate's decision only from `Extended`** (both already enforced); **extend only from `Approved`, or straight from a `Draft` because approval is optional, except a Draft an Admin rejected**, which has to be edited, resubmitted and approved first. A rejection applies to the **candidate**, not just the one offer: once an Admin has rejected any offer for a candidate (a `Rejected` `OfferApproval` on any of their offers; nothing else writes one), a `Draft` for that candidate, whether the rejected one or a **New Version**, must be submitted and approved before it can be extended, so a rejection cannot be sidestepped by starting a new version. Nothing is stored for this: it is derived from the approvals. Every refusal is an `OfferStateException` (a dedicated type, so an unrelated `InvalidOperationException` stays a 500 and its message is never echoed) that `OffersController.GuardAsync` turns into a **409** with the reason. `Offer.Status` is also an EF **concurrency token** (no schema change): an update that raced a status change (an edit against an extend, an extend against a submit or a rejection) is refused with "changed by someone else, reload" instead of overwriting it, via `OfferService.SaveOfferAsync`; the state check comes after the scope check, so a Recruiter outside the candidate's scope still gets 404 and never learns an offer's status.
- **Offer actions obey the candidate rules (#193).** Every offer action first applies the job-opening **End Date lock** (`GetRoleLockErrorAsync`, the same one a status change has), then the offer's own state, then the candidate's stage, in `OfferService`. A refusal about the candidate is an `OfferRuleException`, a **400** with the reason (`OffersController.GuardAsync`); a refusal about the offer is the 409 above. **Create** needs the candidate at `Recommended`, `Offer Preparation` or `Offer Declined` (the last moves back to `Offer Preparation`), and refuses a second live offer (`Draft`, `PendingApproval`, `Approved`, `Extended`) with a **409**. **Update/submit/review** need `Recommended` or `Offer Preparation`. **Extend** and **record decision** run the candidate move through `CandidateService.ValidateStatusChangeAsync` (lock plus transition table) **before** the offer is saved, so a refused move leaves the offer untouched; extend then writes one `Offer Extended` timeline row, because a double click loses the `Offer.Status` concurrency token (409). Not guarded by a unique index: two simultaneous creates for one candidate can both pass the live-offer check (MySQL has no partial unique index).
- **Offers** follow the candidate scope: every offer action resolves the candidate through `OfferService.ApplyCandidateAccess`, so an out-of-scope candidate reads as missing (404). Creating one used to skip that check, which let a Recruiter raise an offer on any candidate, move a Recommended one to Offer Preparation, and read its name and email back. **Approving or rejecting is Admin+** (`[Authorize(Roles = Roles.AdminOrAbove)]`), matching the UI, and applies only to an offer in `PendingApproval` (otherwise 409). It was open to every Recruiter. The reviewer's approval row is created on the fly, because the UI submits offers with no named approvers.
- **Delete is Admin/SuperAdmin only** — `DELETE /api/candidates/{id}` is `[Authorize(Roles = Roles.AdminOrAbove)]`; Recruiters can't delete a candidate/CV at all (not even their own). The UI hides the delete button for non-admins.
- **Interviewer** (bottom of the hierarchy; the former "Viewer", renamed) can **only** reach the dashboard, their assigned interviews (`/api/interviews/*`, `/api/notifications/*`), and evaluations. Candidate list/detail GETs are gated by `[Authorize(Roles = Roles.CanWriteCandidate)]`, and the UI hides those menu items/routes. They still see a candidate's read-only snapshot + CV **through** an interview they're assigned to. That snapshot is returned **without `StatusHistory`** for anyone below Admin (`InterviewService.GetDetailAsync`): the timeline carries every status comment and, through `StatusHistoryDto.EvaluationSummaries`, the rating and recommendation from every completed round, so shipping it let an interviewer read other rounds' verdicts and bypass the peer rule above (issue #116).
- **Job-opening delete is SuperAdmin-only** (`[Authorize(Roles = Roles.SuperAdmin)]` on `DELETE /api/config/roles/{id}`); a role with candidates is soft-disabled and the response reports the count.
- **Config management is Admin+**, but the candidate create/edit forms need active Role/Skill lookups; those are exposed to **CanWriteCandidate** via `GET /api/candidates/role-options` · `/skill-options` so **Recruiters** aren't blocked by the Admin-only `/config/*` endpoints. `role-options` is **scoped**: Admin+ get all active roles; a Recruiter gets only the roles they're an assigned recruiter for (so the candidate form's "Role applied for" offers only their roles, auto-selected when there's exactly one). A Recruiter with **no** assigned role can't create candidates until an Admin assigns them one — enforced server-side too (`CandidateService.CreateAsync`), not only by the dropdown's contents. The recruiter dashboard also gets a **role filter** (`GET /api/dashboard?roleId=`) over their assigned roles + All.
- **End-date lock**: once a `RoleAppliedOption.EndDate` passes, `CandidateService` blocks profile updates and status changes for that role's candidates (all roles, incl. Admin) until an Admin extends the End Date.


### Shared evaluations: the access predicate (#184)
*Automatic grants (#187): booking or rescheduling an interview with "Share earlier rounds' evaluations with this panel" gives each panelist `PanelAutoShare` grants on the earlier non-cancelled rounds. They go through the same predicate, so the panel still cannot read the round it must evaluate. They are revoked when the panelist leaves, the flag is turned off or the interview is cancelled; a manual grant is never touched. Panelists who already read everything are skipped. A booker can therefore give any active user read access to a candidate's earlier rounds by putting them on the panel with the box ticked, the same authority as sharing by hand. These grants have no expiry and cannot be revoked by hand (the share list refuses them, because the next reschedule would simply recreate them): they end when the panelist is removed, the box is unticked or the interview is cancelled. Once the interview has happened none of those can be done any more, so the panel keeps reading until the grant is removed in the database (tracked in the backlog). Manual shares of the same round are separate rows and are never changed by this.*

Grantee reads go through one predicate, `EvaluationAccess` (`Services/EvaluationAccess.cs`), and nothing else decides grantee access. A user may read the **submitted** evaluations of an interview when an active grant covers it (not revoked, not expired, grantee still active; candidate-wide, or naming that interview) **and not** when they are an assigned interviewer on that interview who has not submitted their own evaluation. That second clause is the same-interview peer rule from `InterviewService.GetDetailAsync`: a grant never shows a colleague's verdict on an interview you still have to evaluate. A candidate-wide grant therefore still shows the candidate's other rounds (a product decision for #184: the grantor chose to share). A cancelled interview is never visible. The controller is `[Authorize]` for every role, ignores role and candidate scope, answers **404** without a grant (never 403), and does not widen `GET /api/candidates/{id}/evaluation-report` or `GET /api/interviews/{id}`. A revoke or expiry takes effect on the next request.

## Token model
- **Access token** — short-lived JWT (default 15 min, `Jwt:AccessTokenMinutes`), HS256, returned in the login/refresh response **body**. The client keeps it **in memory only** (not localStorage) to limit XSS exposure.
- **Refresh token** — opaque random value (32 bytes), delivered in an **httpOnly, SameSite=Strict cookie** named `rg_refresh`, **path `/api/auth`**. Server stores only its **SHA-256 hash** (`RefreshToken` entity). Default lifetime 7 days (`Jwt:RefreshTokenDays`).
  - `Secure` is **off in Development** (dev is HTTP) and **on otherwise** — set automatically from `IWebHostEnvironment.IsDevelopment()`.

## Claims
Built in `AuthService.CreateAccessToken(User)`:
- `sub` = user id (the `NameClaimType`).
- `ClaimTypes.Name` = display name, `ClaimTypes.Email` = email.
- one `ClaimTypes.Role` claim **per assigned role** (the `RoleClaimType`).
- `must_change_password = true` when the user has a pending temporary password.

`Services/CurrentUser.cs` (scoped, reads `HttpContext.User`) exposes `UserId`, `Name`, `Email`, `Roles`, `IsInRole`, `IsInAnyRole` to controllers.

## Server pieces
- `Models/User.cs` / `Models/UserRole.cs` — see [data-model.md](data-model.md). `User` has `Email` (unique), `PasswordHash`, `MustChangePassword`, `IsActive`, `CreatedByUserId`, `LastLoginAt`.
- `Services/AuthService.cs` — DB-backed credential verification (PBKDF2), access-token creation, refresh issue/rotate/revoke, and `ChangePasswordAsync`. On **refresh** the user is re-loaded: deactivated users are rejected (token revoked) and claims are rebuilt from current roles, so role changes / deactivation take effect on the next refresh without re-login.
- `Auth/PasswordHasher.cs` — `Hash(password)` → `iterations.saltB64.hashB64` (100k iterations, SHA-256) and `Verify`. Used for seeding, admin-set temp passwords, and self-service change.
- `Services/UserService.cs` — list/create/update/reset-password with validation (unique email, ≥1 valid role) and a guard preventing the **last active SuperAdmin** from being deactivated or stripped of the role.
- `Controllers/AuthController.cs` — `[AllowAnonymous]` only on `login`/`refresh`/`logout`:
  - `POST /api/auth/login` — `{ email, password }` → verify → set refresh cookie → return `AuthResultDto { token, name, email, roles[], mustChangePassword, expiresAt }`.
    - **Failure messages.** `AuthService.CheckLoginAsync` verifies the password **before** the active flag. A wrong password or unknown email is always `401 { message: "Invalid email or password." }`, whether or not the account exists or is inactive. Only when the password is correct and the account is inactive does it return `403 { code: "account_inactive", message: "Your account is inactive. Please contact your administrator." }` (no token, no refresh cookie), which `LoginPage` shows. This keeps the messages from revealing which emails exist or are deactivated (issue #37). Accepted trade-off: the 403 tells someone holding a deactivated account's correct password that it is correct, so keep an eye on rate limiting for the login endpoint.
  - `POST /api/auth/refresh` — rotate refresh token → return new access token + the same richer result.
  - `POST /api/auth/logout` — revoke + clear cookie → `204`.
  - `POST /api/auth/change-password` — `[Authorize]` (allowed through the password-change guard) → verify current, set new hash, clear `MustChangePassword`.
- `Controllers/UsersController.cs` — `[Authorize(Roles = Roles.SuperAdmin)]`: list / create / update / reset-password.
- `Controllers/ConfigurationController.cs` — `[Authorize(Roles = Roles.AdminOrAbove)]`.
- `Controllers/CVUploadController.cs` — `[Authorize(Roles = Roles.CanWriteCandidate)]`.
- `Controllers/CandidateImportController.cs` — `[Authorize(Roles = Roles.AdminOrAbove)]` (JSON + CVs import).

## First-login password change
- Accounts created by a SuperAdmin (and any admin password reset) set `MustChangePassword = true`.
- `Authorization/PasswordChangedRequirement.cs` + handler are added to the `FallbackPolicy`. When the `must_change_password` claim is present, **every** request is denied **except** the allow-list (`/api/auth/change-password`), so a first-login user can only change their password until they do.
- The frontend mirrors this: `ProtectedLayout` redirects to `/change-password` while `mustChangePassword` is set.

## Seeding the first SuperAdmin
On startup (`Program.cs`, after `Migrate()`): if **no users exist**, seed a SuperAdmin from config — `Auth:SeedAdminEmail` (default `admin@recruitmentgorilla.com`), `Auth:SeedAdminName` (default `Super Admin`), and the existing `Auth:PasswordHash` (user secrets) — with `MustChangePassword = false`. This preserves the original admin password while moving identity into the DB. **Log in with that email + the existing admin password.**

## Credentials (hashed)
- `Auth:PasswordHash` is a **PBKDF2-HMAC-SHA256** hash in **user secrets**, format `iterations.saltBase64.hashBase64` (100k iterations, 16-byte salt, 32-byte key). It only seeds the first SuperAdmin; thereafter every user has their own `PasswordHash` row.
- To (re)generate a hash, see [dev-setup.md](dev-setup.md).

## Validation hardening (`Program.cs`)
- `Jwt:Key` from user secrets; startup throws if missing or < 32 bytes.
- `TokenValidationParameters`: validate issuer/audience/lifetime/signing-key; `RequireSignedTokens`, `RequireExpirationTime`; **`ValidAlgorithms = [HS256]`** (prevents alg-confusion); `ClockSkew = Zero`; `MapInboundClaims = false`; `NameClaimType = sub`, `RoleClaimType = role`.
- **Default-deny**: `FallbackPolicy = RequireAuthenticatedUser()` + `PasswordChangedRequirement` — every endpoint needs auth (and a changed password) unless `[AllowAnonymous]`.

## Frontend (`services/api.ts` + `auth/AuthContext.tsx`)
- Axios `withCredentials: true` so the refresh cookie rides along on `/auth/*`.
- Request interceptor attaches the in-memory access token; response interceptor runs a **single-flight** `/auth/refresh` on 401 and retries, else redirects to `/login`.
- `AuthProvider` stores the full `AuthUser { name, email, roles, mustChangePassword }` from the login/refresh response (no JWT decode needed). It exposes `hasRole`, `hasAnyRole`, `isSuperAdmin`, `isAdminOrAbove`, `canWriteCandidates`, `mustChangePassword`, and `refresh()` (re-sync after changing password).
- `components/RequireRole.tsx` guards routes (redirects to `/`, the Dashboard every role can open, when the role is missing). Sign-in with no saved destination and a completed password change also land on `/`. Nav links and candidate write controls are gated by the same flags.

## How to PROTECT a new endpoint
The default-deny fallback already requires auth. To restrict by role, add `[Authorize(Roles = Roles.AdminOrAbove)]` (or another constant) on the controller/action. Only auth/login-style endpoints should be `[AllowAnonymous]`.

## How to CALL a protected API from the client
Add a typed function in `services/api.ts` using the shared `api` instance — the interceptors handle the token and refresh automatically:
```ts
export const archiveCandidate = async (id: number): Promise<void> => {
  await api.post(`/candidates/${id}/archive`);
};
```
For file downloads, fetch a blob through `api` (like `downloadCvFile`) rather than a raw `<a href>`, so the token is sent.

## Production notes
- Enable **HTTPS** — the refresh cookie's `Secure` flag turns on outside Development automatically.
- Move `Jwt:Key` and `Auth:PasswordHash` to environment variables / a secret store.
