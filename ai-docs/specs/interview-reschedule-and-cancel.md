# Spec — Move or Cancel a Scheduled Interview

**Status:** Approved
**Date:** 2026-10-16
**Issue:** [#173](https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/173)

## 1. Summary
A booked interview can be moved in place (date/time, duration, interviewers, interview types, notes)
or cancelled with a reason, by whoever can write the candidate. The affected interviewers are
notified through the existing in-app + email + Slack path with a corrected calendar invite, and the
change leaves a readable trace on the candidate timeline.

## 2. Motivation
An `Interview` row is created as a side effect of the candidate reaching **Interview Scheduled**
(`CandidateService.AddStatusAsync`) and from that moment it is immutable: no endpoint, service method
or UI control changes its date, its interviewers or its existence. An interview booked for Tuesday
that the candidate asks to move to Thursday has nowhere to go; it sits in everyone's calendar and on
the dashboard at the wrong time until it quietly ages out of the upcoming-interviews query.

Two places suggest this already works and both describe something else. This spec's predecessor,
[interview-completion-and-reschedule.md](interview-completion-and-reschedule.md), and
[product-improvement-roadmap.md](../product-improvement-roadmap.md) line 41 both refer to the seeded
transition **Interview Completed (8) -> Interview Scheduled (3)** (Id 31), which books a *new round
after the last one finished*. Reaching it means moving the candidate to Interview Completed, which
`CandidateService` blocks until at least one assigned interviewer has submitted an evaluation. The
only documented route to a new date therefore runs through a gate an un-held interview can never
pass. Transition 31 is correct for what it does and stays; it is not a reschedule.

## 3. Scope
**In scope:** moving a scheduled, not-yet-completed interview in place; cancelling one; notifying the
affected interviewers; a readable trace on the candidate timeline and the interview page.

**Out of scope / later:**
- Notifying the **candidate**. There is no candidate-facing email path in this flow;
  `NotificationService.NotifyAsync` takes a `userId`.
- Availability and conflict checks; timezone handling.
- Auto-cancelling live interviews when a candidate is rejected or discontinued (the right end state,
  deliberately a separate issue).
- Switching the `.ics` from `METHOD:PUBLISH` to `REQUEST`, which would reverse the decision recorded
  at `Services/CalendarInvite.cs:43-47` and send RSVP replies to a mailbox nobody reads.
- `Interview.Status` does not gain a `Completed` value: completion stays candidate-driven, as the
  Interview Completed gate in `CandidateService` assumes.
- Optimistic concurrency on the reschedule (rejecting a stale `CalendarSequence`).

## 4. Data model changes
One migration, **`AddInterviewLifecycle`**.

`Models/Interview.cs` gains:

| Column | Type | Why |
|---|---|---|
| `Status` | `string`, default `"Scheduled"` | `Scheduled` / `Cancelled`. A string, not an enum, matching `Offer.Status`; the non-null default backfills existing rows. |
| `UpdatedAt` | `DateTime?` | Same shape as `Offer.UpdatedAt`. |
| `UpdatedByUserId` | `int?` (SetNull) | Mirrors the existing `CreatedByUserId`. |
| `CalendarSequence` | `int`, default `0` | `SEQUENCE` must survive restarts and increase per UID, so it has to be persisted. |
| `Notes` | `string?` | See below. |

`CancelledAt`, `CancelledByUserId` and `CancellationReason` are deliberately **not** columns: they
are the latest `Cancelled` event's fields and duplicating them guarantees drift.

**Notes.** `InterviewDetailDto.Notes` currently reads `interview.StatusHistory?.Comment`. Editing
notes during a reschedule cannot mean mutating that row: nothing in this codebase updates a
`StatusHistory`, and that row records what was said when the *candidate's status* changed. Add
`Interview.Notes` and read `interview.Notes ?? interview.StatusHistory?.Comment`, so existing
interviews keep working with no backfill.

**New `Models/InterviewEvent.cs`** — append-only narrative of the booking:

`Id`, `InterviewId` (FK, cascade), `EventType` (`Scheduled` / `Rescheduled` / `Cancelled`),
`PreviousScheduledAt` (`DateTime?`), `NewScheduledAt` (`DateTime?`), `Reason` (`string?`),
`ActorUserId` (`int?`, SetNull), `ActorName` (`string`), `CreatedAt`. Index on
`(InterviewId, CreatedAt)`. `ActorName` is denormalized exactly as `StatusHistory.ChangedBy` is, so
the trace survives a user delete. A `Scheduled` event is written at creation time too, otherwise a
reschedule has no origin to point back to.

**New seed row:** `StatusTransition { Id = 50, FromStatusOptionId = 3, ToStatusOptionId = 2, SortOrder = 4 }`
(Interview Scheduled -> Call for Interview). 49 is the current maximum. It must be inserted by the
migration for existing databases as well as added to `HasData`, following the precedent of Id 31.

**Audit.** Interview creation is unaudited today. Add `Interview.Scheduled`, `Interview.Rescheduled`
and `Interview.Cancelled` through `AuditService.RecordAsync` with old and new times in `details`.
`InterviewEvent` is the user-facing trace, `AuditLog` the admin-facing one; they serve different
readers.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/interviews/{id}/schedule` | `[Authorize]` + owner scope | — | `InterviewScheduleDto` | Prefill for the edit form. 404 when the caller cannot write the candidate. |
| PUT | `/api/interviews/{id}` | `[Authorize(Roles = Roles.CanWriteCandidate)]` | `RescheduleInterviewDto` | `InterviewScheduleDto` | Body fully replaces the schedulable fields, matching `PUT /api/candidates/{id}/offers/{offerId}`. |
| POST | `/api/interviews/{id}/cancel` | `[Authorize(Roles = Roles.CanWriteCandidate)]` | `CancelInterviewDto` (required reason) | `InterviewScheduleDto` | Moves the candidate back to Call for Interview. |

`InterviewScheduleDto(Id, CandidateId, CandidateName, Status, ScheduledAt, DurationMinutes, Notes,
InterviewerUserIds, InterviewTypeOptionIds, HasSubmittedEvaluation, Events[])`.

`RescheduleInterviewDto(ScheduledAt, DurationMinutes, Notes, InterviewerUserIds,
InterviewTypeOptionIds, Reason)` — `Reason` optional, included in the interviewers' email.

**Status codes:** 400 on a past target time or on dropping an interviewer who has submitted an
evaluation; 404 out of owner scope or no such interview; 409 when a submitted evaluation exists, when
the candidate has moved past Interview Scheduled, when the candidate is Rejected/Discontinued
(reschedule only), or when the interview is already cancelled.

**Why not a `3 -> 3` self transition and a replacement interview.** It would append a `StatusHistory`
row and re-stamp `CurrentStatus` for something that is not a status change; it would create a
*second* `Interview` row, orphaning the first one's evaluations and breaking both
`OrderByDescending(i => i.CreatedAt).Take(1)` lookups in `CandidateService`; and it would put a
permanent "Interview Scheduled -> Interview Scheduled" entry in every recruiter's status dropdown.

**Why a separate `GET /{id}/schedule`.** `InterviewService.GetDetailAsync` returns `null` for anyone
who is not an assigned interviewer or Admin+, so a Recruiter who owns the candidate gets a 404 on
`GET /api/interviews/{id}` today and cannot prefill an edit form. Widening `GetDetailAsync` would
reopen the privacy rules settled in #116; a narrow read model leaves them alone.

**Cancel then re-book.** Cancelling returns the candidate to Call for Interview, so the existing
`2 -> 3` transition (Id 17) books a fresh interview through the normal add-status flow. The cancelled
row stays as history.

## 6. Backend design
The logic lives in `InterviewService` (`RescheduleAsync`, `CancelAsync`, `GetScheduleAsync`), whose
only write today is `UpsertEvaluationAsync`. Each method owner-scopes the candidate the way
`CandidatesController` does, so an Interviewer gets 403 and an out-of-scope Recruiter gets 404.

**Rules and edge cases:**

| Situation | Behaviour |
|---|---|
| A submitted evaluation exists | **409** on reschedule and cancel. The interview happened; the error points at Interview Completed -> Interview Scheduled (transition 31) for another round. |
| A draft evaluation exists | Allowed. The draft is keyed on `(InterviewId, InterviewerUserId)` and a date change does not invalidate notes; the email tells the drafter it moved. |
| The interview is in the past, not completed | Allowed, this is the no-show case the feature exists for. A **target** time in the past is rejected with 400. |
| Candidate has moved past Interview Scheduled | **409** naming the current status. |
| An interviewer with a **submitted** evaluation is dropped | **400.** Removing them would strand a submitted evaluation the report still aggregates. |
| An interviewer with a **draft** is dropped | Delete the `InterviewInterviewer` row **and** the draft explicitly. The cascade runs from `Interview`, not from the join row, so the draft would otherwise survive and resurface on re-add. The confirm dialog says so first. |
| Candidate is Rejected or Discontinued | Block reschedule (409), allow cancel: the invite is live in people's calendars and this is cleanup. |
| Already cancelled | Cancel again 409. Re-booking goes through Call for Interview -> Interview Scheduled. |
| Applied job opening has ended | Both writes return 400 under the same end-date lock as candidate status changes. |
| Unknown or inactive interview type, oversized notes or reason | Return 400 before saving. Notes have a 4000-character limit; reasons have a 1000-character limit. |

A cancelled interview is filtered out of the upcoming lists: `InterviewService.GetMineAsync` and the
dashboard's upcoming-interviews query both add `Status != "Cancelled"` server-side.

**Timeline trace.** A reschedule appends **no** `StatusHistory` row: that table is append-only and
means "the candidate's status became X at time T", and a reschedule changes neither. Re-asserting
"Interview Scheduled" would corrupt every `HasStatus` / ordering / `Take(1)` reader. A **cancel**
does append one, because the candidate genuinely moves to Call for Interview. `ToStatusHistoryDto`
already resolves the linked interview; add `InterviewScheduledAt`, `InterviewStatus` and a small
`InterviewEvents` list to `StatusHistoryDto` rather than overwriting. `InterviewAt` keeps its current
meaning: the honest record of what was first booked. `GetByIdAsync` needs
`.Include(x => x.Interviews).ThenInclude(i => i.Events)`; it is already `AsSplitQuery()`.

**Calendar invites.** `Services/CalendarInvite.cs` hardcodes `SEQUENCE:0` and `METHOD:PUBLISH`. A
re-issued invite carrying `SEQUENCE:0` for the same UID is *ignored* by calendar clients, so without
this change the emails would be correct while every calendar stayed wrong.
- `InterviewInviteDetails` gains a trailing `int Sequence = 0`. A defaulted positional parameter keeps
  every existing call site, including the tests' six-argument helper, compiling untouched.
- `Build(InterviewInviteDetails d, bool cancelled = false)` emits `SEQUENCE:{d.Sequence}`, and on the
  cancel path `METHOD:CANCEL` + `STATUS:CANCELLED` + an `ORGANIZER` line (RFC 5545 requires it and
  clients drop the message without it). The returned `CalendarAttachment.Method` must match the body,
  since `EmailDispatcher` stamps it into the `text/calendar; method=` parameter.
- `Uid(int interviewId)` is unchanged, and is what makes replacement work at all.
- The existing test `Uses_PUBLISH_because_the_app_cannot_receive_RSVP_replies` does **not** change:
  the default path still emits `PUBLISH`.

**Honest caveat.** Because the original invite is a `PUBLISH` with no `ATTENDEE`, a later `CANCEL`
will not reliably remove the event in Gmail or Outlook. The UID + SEQUENCE *update* path is well
supported; the cancel path much less so. The cancellation **email body is the real notification** and
the `.ics` is best effort.

**Notifications.** `NotificationCategories` gains `InterviewRescheduled` and `InterviewCancelled`
(consts and `All`). No data migration for `NotificationChannelSetting`: `SlackSettingsService.SaveAsync`
upserts a row per `NotificationCategories.All` entry and `IsCategoryEnabledAsync` returns
`row?.SlackEnabled ?? false`, so the new categories appear in the admin UI automatically and default
to Slack-off until a SuperAdmin saves the Slack settings page. That is expected, not a bug.

`EmailTemplates` gains `InterviewRescheduled` (previous time, new time, duration, regenerated
Google/Outlook links) and `InterviewCancelled` (no add-to-calendar links, reason stated plainly)
beside `InterviewAssigned`, both following the `CalendarNotePlaceholder` contract that
`EmailTemplatesTests` pins. Recipients are the union of the old and new interviewer sets, each
getting the message that is true for them:

| Group | Message | `.ics` |
|---|---|---|
| Retained interviewers | `InterviewRescheduled` | PUBLISH, new times, `SEQUENCE + 1` |
| Newly added | existing `InterviewAssigned` | PUBLISH, new times, `SEQUENCE + 1` |
| Removed | `InterviewCancelled` ("you have been removed") | CANCEL |
| Everyone, on cancel | `InterviewCancelled` | CANCEL |

Plus an in-app notification to `interview.CreatedByUserId` when the actor is somebody else: the
recruiter who booked it should not hear about the move from the candidate. All of this reuses
`NotificationService.NotifyAsync` unchanged.

## 7. Frontend design
**Types** (`types/index.ts`): `InterviewLifecycleStatus = 'Scheduled' | 'Cancelled'`,
`InterviewSchedule`, `ReschedulePayload`, `InterviewEventEntry`; add `interviewScheduledAt`,
`interviewStatus` and `interviewEvents` to `StatusHistoryEntry`, and `status` to `InterviewDetail`.

**`services/api.ts`:** `getInterviewSchedule(id)`, `rescheduleInterview(id, payload)`,
`cancelInterview(id, { reason })`.

**Where the actions live.** Primary: `components/StatusTimeline.tsx`, on the Interview Scheduled
entry, when `entry.interviewId && entry.interviewStatus === 'Scheduled'` and a new
`canManageInterview` prop is true — `CandidateDetailPage` already computes
`canWrite = canWriteCandidates && !data.roleClosed`, so pass that through. Secondary: the
`InterviewPage` hero next to the `interview-chip`, Admin+ only, with a read-only `Cancelled` chip for
everyone else. `UpNextCard` gets **no** write affordance (it is a dense scan list with whole-row
links); cancelled interviews are filtered server-side instead.

**New `components/RescheduleInterviewModal.tsx`, not a dual-mode `AddStatusModal`.** `AddStatusModal`'s
whole contract is "choose the candidate's next status": the status dropdown, the `requiresComment` /
`requiresTaskDetails` / `requiresSubmissionUrl` rules, the `addStatus` mutation and the
`['status-options','next']` query. An interview edit shares four fields and none of that logic.
`CreateOfferModal`'s dual mode works because create and edit send the same body to the same shape,
which is not true here. The new modal reuses `Sheet`, `DatePicker withTime`, `NativeSelect`,
`SearchableMultiSelect` and the `Req` marker. `DURATION_OPTIONS` is lifted out of `AddStatusModal`
into a shared constant so the two forms cannot drift.

Fields: date/time (required, must be in the future), duration, interview types, interviewers
(required, at least one), notes, and a reason for the change (optional on reschedule, included in the
interviewers' email).

**Cancel** reuses `components/common/ConfirmModal.tsx`, which takes `children` as the body: pass a
`Textarea` for the reason and keep `onConfirm` disabled while it is empty.

**Timeline rendering.** Inside the existing "Interview:" block, render
`entry.interviewScheduledAt ?? entry.interviewAt` as the headline date (this alone fixes the stale
date); add a muted "Rescheduled from 20 Oct, 14:00 by Alice" sub-line when events exist; show a
`Cancelled` badge with the date struck through and the reason when the interview is cancelled.

**Invalidation.** Reschedule: `['candidates']`, `['candidate', candidateId]`, `['notifications']`,
`['my-interviews']`, `['dashboard']`, `['interview', interviewId]`,
`['interview-schedule', interviewId]`. Cancel adds `['status-options', 'next', candidateId]`, because
the candidate's stage really does change. Reschedule omits that key precisely because the stage does
not, which is worth a code comment.

## 8. Security & auth
`InterviewsController` keeps its bare `[Authorize]` (interviewers need the GETs and the evaluation
PUT); the three new actions carry `[Authorize(Roles = Roles.CanWriteCandidate)]` per action, as
`OffersController` does. The service owner-scopes the candidate, so an Interviewer gets 403 and an
out-of-scope Recruiter gets 404. `GET /{id}/schedule` is a narrow read model that deliberately does
not widen `GetDetailAsync`. Validation: target time must be in the future; at least one interviewer;
cancel reason required. Role-closed candidates hide both affordances client-side, consistent with
`canWrite`.

## 9. Acceptance criteria / verification
- [ ] A Recruiter who owns the candidate can move a scheduled interview's date, duration,
      interviewers, types and notes from the candidate timeline, and the new date shows immediately.
- [ ] Cancelling asks for a reason, moves the candidate to Call for Interview, and the timeline shows
      the cancellation with its reason.
- [ ] Retained, added and removed interviewers each receive the message that is true for them, with a
      calendar attachment whose `METHOD` matches its body and whose `SEQUENCE` has increased.
- [ ] A submitted evaluation blocks both operations with a 409 that names transition 31.
- [ ] Dropping an interviewer who has a draft deletes the draft; dropping one who has submitted is
      refused with 400.
- [ ] Cancelled interviews disappear from the dashboard's upcoming list and from `GET /api/interviews/mine`.
- [ ] A reschedule appends no `StatusHistory` row and leaves `CurrentStatus` untouched.
- [ ] `PUT /api/interviews/{id}` and `POST /api/interviews/{id}/cancel`: Interviewer 403, anonymous
      401, out-of-scope Recruiter 404.
- [ ] `dotnet build`, `dotnet test`, `npx tsc -b`, `npm test`, `npm run lint` and the Playwright
      reschedule spec all pass. Its default test is read-only; the write cycle requires an isolated
      database and `E2E_ISOLATED=1`.

## 10. Open questions
1. Should rejecting or discontinuing a candidate auto-cancel their live interviews? The right end
   state, deliberately out of this scope.
2. Should `Interview.Status` also gain `Completed`, synced from the candidate's status? Decided no:
   completion stays candidate-driven, as the Interview Completed gate assumes.
3. Optimistic concurrency on the reschedule (reject a stale `CalendarSequence`): noted and not built,
   low value at this team size.
