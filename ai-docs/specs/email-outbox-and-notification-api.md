# Spec: Durable Email Outbox + Notification API Provider

**Status:** Partially implemented (outbox: Implemented; Notification API provider: Planned)
**Author:** tahmidsparrow
**Date:** 2026-10-08

## 1. Summary
Replaces the in-memory email queue with a database-backed outbox so a queued email survives an API restart, retries on a sensible schedule instead of three times in seven seconds, and shows up in an admin-visible delivery log with a manual Resend. A second, later phase lets a SuperAdmin point outbound email at the company's HR notification HTTP API instead of (or alongside) SMTP, configured entirely from Configuration → Email.

## 2. Motivation
The existing `EmailQueue`/`EmailQueueWorker` is an in-memory `Channel<EmailJob>`: fine for availability during a request, but every pending email is lost the moment the process restarts or crashes mid-retry, and there is no way for an admin to see what was sent, to whom, or why a send failed. Separately, the team wants the option to send transactional email through an internal HTTP notification service rather than SMTP, with the same "configure it from the app, not from a config file" pattern already used for SMTP and Slack.

## 3. Scope
**In scope (this phase: the outbox):**
- A durable `OutboundEmail` table and `EmailOutboxProcessor`/`EmailOutboxWorker` replacing `EmailQueue`/`EmailQueueWorker`.
- A retry policy with escalating delays (5 / 15 / 60 minutes) instead of near-immediate exhaustion.
- Crash recovery: a row stuck "being sent" past its lock window is picked back up.
- A SuperAdmin-only delivery log (Configuration → Email delivery) with a per-row Resend for a `Failed`/`Unknown` email.
- Every existing email trigger (account created, password reset/changed, interview assigned with its calendar invite, admin test) keeps working unchanged from the caller's point of view: `EmailService.SendAsync`'s signature didn't change.

**Out of scope / later (next phase):**
- The actual HTTP notification-API provider, idempotency-key-based deduplication, and status-check-before-resend for an `Ambiguous` outcome. The data model (`Provider`, `NeedsStatusCheck` columns) and the `EmailOutcome.Ambiguous` case already exist so that phase needs no new migration for the outbox itself, only for the provider's own settings (base URL, API key, allowed recipient domains).
- SMTP stays the only active provider until that phase ships; the admin will then choose between SMTP and the notification API per the existing "one provider, one settings form" pattern (`EmailSetting`, `SlackSetting`).

## 4. Data model changes
Migration: `AddEmailOutbox`.

- **`OutboundEmail`**: `Id` bigint, `Reference` char(36) unique, `ToEmail` varchar(320), `ToName` varchar(200), `Subject` varchar(400), `HtmlBody` longtext, `CalendarFileName`/`CalendarMethod` varchar(255)/(20)? + `CalendarContent` longtext?, `Status` varchar(16) (`Pending`/`Sending`/`Sent`/`Failed`/`Unknown`), `Provider` varchar(16)?, `Attempts` int, `NextAttemptAt` datetime, `LockedUntil` datetime?, `NeedsStatusCheck` bool, `LastError` varchar(1000)?, `ProviderMessageId` varchar(200)?, `CreatedAt`/`SentAt`?/`UpdatedAt`. Indexes: unique on `Reference`, composite on `(Status, NextAttemptAt)` for the processor's due-work query.
- No change to `EmailSetting` in this phase (the provider/API-key columns belong to the next phase).

See [data-model.md](../data-model.md).

## 5. API contract
Both new endpoints sit on `ConfigurationController` alongside the existing Email/Slack ones.

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/config/email/outbox` | SuperAdmin | `?status=&page=&pageSize=` | `PagedResult<OutboundEmailDto>` | Never returns the HTML body |
| POST | `/api/config/email/outbox/{id}/resend` | SuperAdmin | none | `ResendEmailResultDto` (`{ok, error?}`) | 404 if the id doesn't exist; 400 if the row isn't `Failed`/`Unknown`. Audited as `Email.Resent` |

## 6. Backend design
- **`EmailService.SendAsync`** (unchanged signature, still never throws): writes a `Pending` `OutboundEmail` row and nudges `IEmailOutboxSignal` (a capacity-1 channel that only ever says "something's due", not a queue of the emails themselves). `SendTestAsync` is unchanged: it still sends immediately through `IEmailDispatcher` so the admin test button gets an answer right away.
- **`IEmailDispatcher`/`EmailDispatcher`**: the actual network send, extracted from the old `EmailService.SendCoreAsync`. Maps failures to an `EmailOutcome` via `EmailDeliveryException`:
  - `Permanent`: bad credentials (`AuthenticationException`) or a 5xx SMTP reply (retrying would fail the same way every time).
  - `Retry`: anything else (connection refused, timeout, a transient 4xx).
  - `Ambiguous`: not reachable from SMTP today (a plain SMTP send either goes through or it doesn't); reserved for an HTTP provider whose send can time out without telling you which.
- **`EmailOutboxProcessor.ProcessDueAsync`**: selects up to 20 due rows (`Pending` past `NextAttemptAt`, or `Sending` past `LockedUntil`, a crashed worker's row), claims each with an atomic `ExecuteUpdateAsync` compare-and-swap (so a second instance's claim attempt affects zero rows), then sends it. On success: `Sent`, `ProviderMessageId`, `SentAt`. On `Retry`: reschedules at `RetryDelays[Attempts-1]` (5 / 15 / 60 min, or the provider's own `Retry-After` if longer), or `Failed` once delays are exhausted. On `Permanent`: `Failed` immediately, no retry. `PurgeOldAsync` deletes `Sent`/`Failed` rows older than `EmailOutbox:RetentionDays` (default 30).
- **`EmailOutboxWorker`** (`BackgroundService`): wakes on `IEmailOutboxSignal` or a 30-second `PeriodicTimer` tick, whichever comes first, then runs one processing pass in a fresh DI scope; runs the hourly purge from the same loop.
- **`EmailOutboxService`** (SuperAdmin): `QueryAsync` (paged, status-filterable, metadata only) and `ResendAsync` (only from `Failed`/`Unknown`, keeps the same `Reference`, resets `NextAttemptAt` to now and nudges the signal).

## 7. Frontend design
- **Types** (`types/index.ts`): `OutboundEmail`, `OutboundEmailStatus`, `OutboundEmailQuery`, `ResendEmailResult`.
- **`services/api.ts`**: `getEmailOutbox`, `resendEmail`.
- **`pages/configuration/EmailDeliveryTab.tsx`** (new SuperAdmin-only tab, modeled on `AuditLogPage`): a `Segmented` status filter, a `table-cards` list (queued time, recipient, subject, a status `Badge`, attempts, last error), `Pagination`, and a per-row `RowActions` → Resend for `Failed`/`Unknown` rows behind a `ConfirmModal` (which warns about a possible duplicate send when the status is `Unknown`, since its outcome was never confirmed). `ConfigurationPage.tsx` gates the tab the same way as Email/Slack (absent, not disabled, for non-SuperAdmins).

## 8. Security & auth
- Both endpoints are SuperAdmin-only (covered by `ControllerAuthorizationTests`).
- The delivery log never returns the HTML body (`OutboundEmailDto` omits it): it can contain account details (password-reset notices, interview links).
- Resend is audited (`Email.Resent`) with the recipient and row id, same as every other config mutation in this controller.
- No new secret, no new inbound surface: the outbox is a database table and a background loop, not a network endpoint, so the "never expose the backend" rule (AGENTS.md) is unaffected.

## 9. Acceptance criteria / verification
- [x] `dotnet test`: 413 passed, including new `EmailOutboxTests`, `EmailDispatcherTests`, rewritten `EmailServiceTests`/`NotificationServiceTests` (outbox-row assertions instead of synchronous-send assertions), a new `BackgroundQueueTests` case for `EmailOutboxWorker`, and new `ControllerAuthorizationTests` cases for the two endpoints.
- [x] `npx tsc -b` and `npm test`: 168 passed, including `EmailDeliveryTab.test.tsx`.
- [ ] Manual: trigger an email (e.g. create a user), confirm it appears in Configuration → Email delivery as `Sent`. Point SMTP at a bad host, trigger another, confirm it shows `Pending` with a future `NextAttemptAt`, and that it's still there (and still retried) after restarting the API. Force a permanent failure (wrong password) and confirm **Resend** re-queues it.

## 10. Open questions
- Exact field names for the notification API's HTML/sender-name support, and whether it can accept the `.ics` attachment: both affect whether the next phase keeps styled HTML email or has to fall back to plain text. See the plan shared with the team for the proposed contract (`Idempotency-Key` header, `GET /emails/{key}` status check).
- Whether `EmailOutbox:RetentionDays` needs to be lower in practice once the delivery log sees real volume: 30 days was chosen to match nothing more specific than "long enough to investigate a complaint, short enough not to accumulate forever."
