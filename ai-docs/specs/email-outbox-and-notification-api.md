# Spec: Durable Email Outbox + Notification API Provider

**Status:** Implemented
**Author:** tahmidsparrow
**Date:** 2026-10-09

## 1. Summary
Replaces the in-memory email queue with a database-backed outbox so a queued email survives an API restart, retries on a sensible schedule instead of three times in seven seconds, and shows up in an admin-visible delivery log with a manual Resend. A SuperAdmin can also point outbound email at the company's HR notification HTTP API instead of SMTP, configured entirely from Configuration → Email, with an idempotency key and a status check so an ambiguous send is never blindly resent.

## 2. Motivation
The old `EmailQueue`/`EmailQueueWorker` was an in-memory `Channel<EmailJob>`: fine for availability during a request, but every pending email was lost the moment the process restarted or crashed mid-retry, and there was no way for an admin to see what was sent, to whom, or why a send failed. Separately, the team wants the option to send transactional email through an internal HTTP notification service rather than SMTP, with the same "configure it from the app, not from a config file" pattern already used for SMTP and Slack.

## 3. Scope
**In scope:**
- A durable `OutboundEmail` table and `EmailOutboxProcessor`/`EmailOutboxWorker` replacing `EmailQueue`/`EmailQueueWorker`.
- A retry policy with escalating delays (5 / 15 / 60 minutes) instead of near-immediate exhaustion, and crash recovery for a row stuck "being sent" past its lock window.
- A SuperAdmin-only delivery log (Configuration → Email delivery) with a per-row Resend for a `Failed`/`Unknown` email.
- A second email provider, the HR notification HTTP API, chosen per `EmailSetting.Provider` alongside the existing SMTP provider; an idempotency key and a status-check-before-resend path so an ambiguous outcome is never auto-resent blind.
- A recipient allow-list for the HTTP API provider (only `@ajentica.ai` today), checked before the API is ever called.
- Every existing email trigger (account created, password reset/changed, interview assigned with its calendar invite, admin test) keeps working unchanged from the caller's point of view: `EmailService.SendAsync`'s signature didn't change.

**Out of scope / later:**
- Sending the calendar `.ics` invite as an attachment through the HTTP API: the contract the service was given has no attachment field, so `EmailApiOptions.SupportsAttachments` stays `false` until the service confirms one. Until then, an interview-assigned email sent through that provider keeps the Google/Outlook "add to calendar" links in the body but no attachment, and the body never claims one is attached (see `EmailTemplates.CalendarNotePlaceholder`).
- The HTML/`from_name` field names and the `Idempotency-Key`/status-check endpoint are this client's own proposal to the service owner (see §10); if the service's actual contract differs, only `HttpEmailApiTransport`'s request/response mapping needs to change.
- Candidate-facing email remains out of scope (internal-team-only, same as before this phase).

## 4. Data model changes
Migrations: `AddEmailOutbox` (the outbox table), `AddEmailApiProvider` (this phase).

- **`OutboundEmail`**: `Id` bigint, `Reference` char(36) unique (also the idempotency key sent to the HTTP API), `ToEmail` varchar(320), `ToName` varchar(200), `Subject` varchar(400), `HtmlBody` longtext, `CalendarFileName`/`CalendarMethod` varchar(255)/(20)? + `CalendarContent` longtext?, `Status` varchar(16) (`Pending`/`Sending`/`Sent`/`Failed`/`Unknown`), `Provider` varchar(16)? (`Smtp`/`HttpApi`, set once a send is actually attempted), `Attempts` int, `NextAttemptAt` datetime, `LockedUntil` datetime?, `NeedsStatusCheck` bool, `LastError` varchar(1000)?, `ProviderMessageId` varchar(200)?, `CreatedAt`/`SentAt`?/`UpdatedAt`. Indexes: unique on `Reference`, composite on `(Status, NextAttemptAt)` for the processor's due-work query.
- **`EmailSetting`** gains: `Provider` varchar(16) not null, default `Smtp` (existing rows are unaffected), `ApiBaseUrl` varchar(500)?, `ApiKeyEncrypted` varchar(1000)? (same `SecretProtector` as `PasswordEncrypted`), `AllowedRecipientDomains` varchar(500)?. `FromName` is unchanged and shared by both providers; `Host`/`Port`/`User`/`PasswordEncrypted`/`FromAddress`/`UseStartTls` stay SMTP-only.

See [data-model.md](../data-model.md).

## 5. API contract
Both delivery-log endpoints sit on `ConfigurationController` alongside the existing Email ones; the Email settings endpoints are extended rather than duplicated.

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/config/email` | SuperAdmin | none | `EmailSettingsDto` | Gains `provider`, `apiBaseUrl`, `allowedRecipientDomains`, `apiKeySet`; never returns a secret |
| PUT | `/api/config/email` | SuperAdmin | `UpsertEmailSettingsDto` | `EmailSettingsDto` | Gains `provider`, `apiBaseUrl`, `apiKey` (write-only), `allowedRecipientDomains`. 400 if the provider is `HttpApi` and the base URL isn't an absolute `https://` address, or if the base URL's host changed with no new key supplied |
| POST | `/api/config/email/test` | SuperAdmin | `{toEmail}` | `TestEmailResultDto` (`{ok, error?, messageId?}`) | `messageId` is set only on a successful HTTP API send |
| GET | `/api/config/email/outbox` | SuperAdmin | `?status=&page=&pageSize=` | `PagedResult<OutboundEmailDto>` | Never returns the HTML body |
| POST | `/api/config/email/outbox/{id}/resend` | SuperAdmin | none | `ResendEmailResultDto` (`{ok, error?}`) | 404 if the id doesn't exist; 400 if the row isn't `Failed`/`Unknown`. Audited as `Email.Resent` |

## 6. Backend design
- **`EmailService.SendAsync`** (unchanged signature, still never throws): writes a `Pending` `OutboundEmail` row and nudges `IEmailOutboxSignal`. **`SendTestAsync`** still sends immediately through `IEmailDispatcher`, now returning an `EmailSendResult { Provider, MessageId }` so the admin test button can show the id.
- **`IEmailSettingsResolver.ResolveAsync`** returns an `EmailDeliveryOptions { Provider, Smtp, Api }` (not just `SmtpOptions`): the in-app row when enabled, decrypting whichever provider's secret it stores, else config (`Email:Provider` picks between the `Smtp` and `EmailApi` fallback sections).
- **`EmailDispatcher.SendAsync`** branches on `options.Provider`. For the HTTP API: checks `AllowedRecipientDomains` before ever calling the service (a `Permanent` failure, `recipient_domain_not_allowed`, if the domain isn't listed), converts the HTML body to a plain-text alternative (`HtmlToText.Convert`), substitutes `EmailTemplates.CalendarNotePlaceholder` with the real "open the attached invite" sentence only when an attachment will actually go out (`SupportsAttachments && Calendar is not null`, today always false), and calls `IEmailApiTransport.SendAsync`. On success it returns an `EmailSendResult` carrying which provider actually sent it, so the outbox row's `Provider` column reflects reality even if the admin switches providers between retries.
- **`IEmailApiTransport`/`HttpEmailApiTransport`**: a plain typed `HttpClient` (the base URL is admin-editable, so unlike `HttpSlackTransport` it's never baked into `BaseAddress`; every call builds its own absolute URI). `POST {base}/send-email` with `X-API-Key` and `Idempotency-Key: {Reference}` headers and `{to, subject, body, html, from_name}`. Maps the response to `EmailOutcome`: 401/403 and 429/`rate_limited` map to `Permanent`/`Retry` respectively, 5xx and a network error before any response map to `Retry`, a `TaskCanceledException` from the client's own timeout (not the caller's cancellation) maps to `Ambiguous` (the request may have reached the service), and a 2xx body that isn't `{"status":"sent"}` is also `Ambiguous` rather than assumed either way. `GetStatusAsync` (`GET {base}/emails/{reference}`) never throws: a network failure, a plain 404 with no body, or any response that doesn't parse returns `Unsupported`, since the only safe move when the question can't be answered is to leave the row for an admin.
- **`EmailOutboxProcessor`**: a row with `NeedsStatusCheck` is checked (`IEmailDispatcher.CheckStatusAsync`) before any resend. `Sent` marks the row done; `Failed`/`NotFound` resends immediately with the same `Reference`; `Pending` reschedules another check in 5 minutes; `Unsupported` marks the row `Unknown` and stops, never guessing. A fresh `Retry`/`Permanent`/`Ambiguous` failure is unchanged from the outbox-only phase (escalating delays, immediate `Failed`, or a `NeedsStatusCheck` flag with a 5-minute recheck).
- **`EmailSettingsService.SaveAsync`** (`(bool Ok, string? Error)`, mirroring `SlackSettingsService`): a secret is write-only (blank keeps the stored one); changing `ApiBaseUrl`'s host without also supplying a new `ApiKey` is rejected, so a stored key can't silently start being sent to a different host. The audit entry (`Config.EmailUpdated`) records the provider, whether each secret was replaced, and the base URL's host, never the secret itself.

## 7. Frontend design
- **Types** (`types/index.ts`): `EmailSettings`/`UpsertEmailSettings` gain `provider`/`apiBaseUrl`/`allowedRecipientDomains`/`apiKeySet`/`apiKey`; a new `TestEmailResult` type carries `messageId`.
- **`pages/configuration/EmailSettingsTab.tsx`**: a `Segmented` provider choice ("SMTP server" / "Notification API") at the top of the settings card. SMTP shows the existing presets and fieldsets unchanged; the HTTP API shows its own fields (base URL, write-only API key, allowed recipient domains) plus the shared "From Display Name" (the address itself is fixed by the service). The test card works for either provider and shows the returned message id. A save failure's server message (e.g. the host-changed-without-a-key rejection) is read from the response body and shown inline, the same pattern `JobOpeningsTab` already uses for its own 400s.
- **`pages/configuration/EmailDeliveryTab.tsx`** (from the outbox-only phase, unchanged here): a status-filtered delivery log with a per-row Resend.

## 8. Security & auth
- All email settings and delivery-log endpoints are SuperAdmin-only (covered by `ControllerAuthorizationTests`).
- Neither the SMTP password nor the API key is ever returned by `GET`, logged, or written to the audit trail; only whether each was replaced.
- A recipient is validated with `MailAddress.TryCreate` (and must round-trip exactly) before its domain is checked against `AllowedRecipientDomains`, closing off addresses crafted to carry a second address or extra recipients past the check; a recipient outside the list is rejected before the HTTP API is ever called, not left for the service to enforce.
- `ApiBaseUrl` is validated as a plain absolute `https://` URL (no embedded credentials, query, or fragment) on every save, regardless of which provider the save is for, since the column is shared state that outlives any one save. Changing its origin (scheme + host + port) without re-entering the key is rejected the same way, for the same reason — this closes a gap where a save made while SMTP was selected could otherwise plant a new, unvalidated `ApiBaseUrl` for a later save to switch to without ever being asked for the key again.
- The HTTP API's `HttpClient` has automatic redirects disabled: .NET forwards custom headers (including `X-API-Key`) and, for 307/308, the request body across a redirect, so a compromised or misconfigured service could otherwise leak the key and the email content to whatever host it redirects to.
- A provider's `Retry-After` is capped at one hour before being used to schedule a retry, so a malicious or buggy value can't leave a row silently "Pending" far longer than anyone would actually wait.
- No new inbound surface: the HTTP API transport only makes outbound HTTPS calls, the same shape as the existing Slack integration; the "never expose the backend" rule (AGENTS.md) is unaffected.

## 9. Acceptance criteria / verification
- [x] `dotnet test`: all backend tests passing, including `EmailApiClientTests`, `HtmlToTextTests`, `EmailTemplatesTests`, extended `EmailDispatcherTests`/`EmailOutboxTests`/`EmailSettingsServiceTests` for the HTTP API provider and the status-check-then-act flow.
- [x] `npx tsc -b` and `npm test`: all frontend tests passing, including extended `EmailSettingsTab.test.tsx` (provider switching, a blank key keeping the stored one, a save failure showing the server's message, a test send showing the message id).
- [ ] Manual: paste a real API key at Configuration → Email → Notification API, send a test to an `@ajentica.ai` address and confirm the message id appears; send a test to any other domain and confirm it's rejected before the API is called. Switch back to SMTP and confirm it still works unchanged. Change the base URL's host without a new key and confirm the save is rejected.

## 10. Open questions
- **Field names and attachment support are this team's proposal, not yet confirmed by the service owner.** The service as given only documents `{to, subject, body}`; `html`, `from_name`, `Idempotency-Key` and `GET /emails/{reference}` are what we asked for. If the service owner confirms different names (or that attachments are supported), only `HttpEmailApiTransport`'s request/response mapping and `EmailApiOptions.SupportsAttachments` need to change, nothing in the outbox or the rest of the dispatch path.
- Until the service adds the idempotency key and status-check endpoint, every `Ambiguous` outcome against it resolves to `Unknown` (`GetStatusAsync` returns `Unsupported` for any response it doesn't recognize) rather than being auto-resent, and an admin resends those by hand from the delivery log.
- Whether `EmailOutbox:RetentionDays` (default 30) needs to be lower in practice once the delivery log sees real volume.
