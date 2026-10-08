# Spec — Slack Notifications

**Status:** Implemented
**Author:** tahmidsparrow
**Date:** 2026-10-08

## 1. Summary
Recruitment Gorilla notifications (in-app bell, and for some events, email) can now also be sent as a Slack direct message from a dedicated bot, so interviewers, recruiters and admins see them where they already work. Routing is per notification category and configured by a SuperAdmin at **Configuration → Slack**.

## 2. Motivation
The in-app bell is only checked when someone opens the app; email lands in an inbox people don't always watch during the day. The team already lives in Slack (see the GorillaHR sibling project's own Slack integration), so mirroring the existing notifications there closes the gap without adding a new place to check.

## 3. Scope
**In scope:**
- A new Slack bot (separate Slack app from any other integration), bot-token auth, direct messages only.
- Slack delivery for the 3 notification categories that already have, or gain, a recipient with real access to act: **Interview assigned**, **Evaluation submitted**, **Assigned to job opening** (new trigger).
- SuperAdmin-only settings UI: bot token, master enabled switch, per-category toggle, test-DM button.
- Background queue + retry, mirroring the existing email queue.

**Out of scope / later:**
- Channel posts (team-wide summaries). DMs only, so a message never reaches someone without access to that candidate/job opening in the app.
- Slash commands, interactive buttons, Events API, OAuth install flow (no inbound Slack traffic at all — the bot only calls out).
- Candidate-facing notifications (candidates aren't Slack workspace members).
- Per-user opt-out or a stored Slack-user mapping — recipients are resolved by email on every send (`users.lookupByEmail`), same as GorillaHR's design.
- The "Offer Approval Requested" notification: the UI never currently submits an offer with named approvers (`submitOfferForApproval` always sends `[]` — see `OfferCard.tsx`), so that notification never fires today and gets no category.

## 4. Data model changes
Migration: `AddSlackNotifications`.

- **`SlackSettings`** (single row, `Id = 1`): `BotTokenEncrypted` varchar(1000)? (AES-256-GCM via `SecretProtector`, same key as the SMTP password), `Enabled` bool, `UpdatedAt`, `UpdatedByUserId` int?. No row, or `Enabled = false`, falls back to the `Slack:BotToken` config/user-secret.
- **`NotificationChannelSettings`** (one row per category): `Category` varchar(64) PK, `SlackEnabled` bool. A missing row means Slack is off for that category. Named generically so a future channel is another column here, not a parallel table.

See [data-model.md](../data-model.md).

## 5. API contract
All three endpoints are `[Authorize(Roles = Roles.SuperAdmin)]`, alongside the existing Email ones on `ConfigurationController`.

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/config/slack` | SuperAdmin | — | `SlackSettingsDto` (`enabled, botTokenSet, configFallback, updatedAt, categories: [{key, label, slackEnabled}]`) | Never returns the token |
| PUT | `/api/config/slack` | SuperAdmin | `UpsertSlackSettingsDto` (`botToken?, enabled, categories: [{key, slackEnabled}]`) | `SlackSettingsDto` | `botToken` blank keeps the stored one; non-blank must start `xoxb-`; unknown category key → 400 |
| POST | `/api/config/slack/test` | SuperAdmin | `{ toEmail }` | `{ ok, error? }` (always 200) | Looks up `toEmail` in the Slack workspace and DMs a test message using the **saved** settings |

## 6. Backend design
- **`NotificationCategories`** — the 3 keys + display labels: `InterviewAssigned`, `EvaluationSubmitted`, `RecruiterAssigned`.
- **`NotificationService.NotifyAsync`** gains an optional `category` parameter. After writing the in-app `Notification`, if `category` is set it calls `SlackService.EnqueueAsync(category, user.Email, title, message, linkUrl)` alongside the existing email branch. A call with no category (e.g. offer approval) never touches Slack.
- **`SlackSettingsResolver`** — `ResolveTokenAsync()` (DB row if enabled & decrypts, else `Slack:BotToken` config, else null) and `IsCategoryEnabledAsync(category)` (token resolves AND that category's row is on).
- **`SlackService.EnqueueAsync`** — no-op unless a token resolves and the category is routed; otherwise builds the mrkdwn text and enqueues a `SlackJob`. Never throws (best-effort, like `EmailService.SendAsync`).
- **`SlackClient` (`ISlackTransport`/`HttpSlackTransport`)** — a typed `HttpClient` POSTing form data to the Slack Web API with `Authorization: Bearer`. Maps the response to `SlackApiException(code, isTransient, retryAfter?, neededScope?)`: 429/5xx/network errors are transient; `missing_scope`/`invalid_auth`/any other `ok:false` are not.
- **`SlackQueue`/`SlackQueueWorker`** — a bounded `Channel<SlackJob>` + `BackgroundService`, mirroring `EmailQueue`/`EmailQueueWorker`. Transient failures retry up to 3 times (honoring Slack's `Retry-After` when given); `users_not_found` is logged at Information (not an error — the person just isn't in the workspace); other permanent failures log a Warning and are dropped.
- **Message format** — plain Slack mrkdwn: `*title*\nmessage\n<absoluteLink|Open in Recruitment Gorilla>`. `&`/`<`/`>` in the title/message are escaped so a candidate or job-opening name can't forge a link or an `@channel` mention. The link is built from `App:ClientBaseUrl`; omitted if that's unset. Truncated at 3000 characters.
- **New trigger — Assigned to job opening** (`ConfigurationService.CreateRoleAsync`/`UpdateRoleAsync`): notifies recruiters **newly** added to a job opening (on update, the old recruiter set is diffed against the new one so already-assigned recruiters aren't re-notified), skips the actor, and skips entirely when the opening isn't active.
- **Existing triggers tagged:** `CandidateService.AddStatusAsync` (Interview assigned) and `InterviewService.NotifyEvaluationSubmittedAsync` (Evaluation submitted) now pass their category.

## 7. Frontend design
- **Types** (`types/index.ts`): `SlackSettings`, `SlackCategorySetting`, `UpsertSlackSettings`.
- **`services/api.ts`**: `getSlackSettings`, `saveSlackSettings`, `sendTestSlack`.
- **`pages/configuration/SlackSettingsTab.tsx`** (modeled on `EmailSettingsTab`): write-only bot token (`PasswordInput`, "leave blank to keep" when `botTokenSet`), an Enabled switch, one `CheckboxField` per category, a test-DM card, and a setup note (scopes, email-matching). `isSuperAdmin`-only tab on `ConfigurationPage.tsx`, same gating as Email.

## 8. Security & auth
- All 3 endpoints are SuperAdmin-only (covered by `ControllerAuthorizationTests`).
- The bot token is encrypted at rest (`SecretProtector`, same as the SMTP password) and never returned to the client; GET exposes only `botTokenSet`/`configFallback` booleans. The save audit entry (`Config.SlackUpdated`) never includes the token.
- DMs only, no channel posts — a recipient only ever receives what their own access scope in the app would show them, since the category triggers already compute recipients the same way the in-app notification does.
- The bot is outbound-only: no inbound webhook, no signature verification needed, no new port or public URL. Keeps the "never expose the backend to the network" rule (AGENTS.md).
- Untrusted text (candidate/job names) is mrkdwn-escaped before being sent to Slack.

## 9. Acceptance criteria / verification
- [x] `dotnet test` — 388 passed (unit: `SlackServiceTests`, `HttpSlackTransportTests`, `SlackSettingsServiceTests`, `ConfigurationServiceTests` new cases, `NotificationServiceTests` new cases, `BackgroundQueueTests` new cases; integration: `ControllerAuthorizationTests` new cases).
- [x] `npx tsc -b` and `npm test` — 163 passed, incl. `SlackSettingsTab.test.tsx`.
- [ ] Manual: create the Slack bot from the manifest below, paste the token at Configuration → Slack, enable it + all 3 categories, send a test DM, then exercise each trigger (schedule an interview, submit an evaluation, add a recruiter to a job opening) and confirm the DM arrives and the in-app bell still fires. Turn one category off and confirm only that DM stops.

## 10. Slack app manifest
Paste this at [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From an app manifest, install it to the workspace, then copy the Bot User OAuth Token (`xoxb-...`).

```yaml
display_information:
  name: Recruitment Gorilla
  description: Interview and job-opening notifications
features:
  app_home:
    messages_tab_enabled: true
    messages_tab_read_only_enabled: true
  bot_user:
    display_name: Recruitment Gorilla
    always_online: false
oauth_config:
  scopes:
    bot:
      - chat:write
      - users:read
      - users:read.email
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

No event subscriptions or slash commands — the bot never receives inbound traffic.

## 11. Open questions
- Candidate-facing Slack/email notifications remain future scope (candidates aren't Slack workspace members).
- If a future need arises for team-wide channel posts (e.g. "new candidate uploaded"), that's a distinct delivery mode from the DM-only design here and should get its own category/toggle rather than overloading these three.
