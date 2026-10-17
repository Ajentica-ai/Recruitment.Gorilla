# Move or cancel a scheduled interview
- Source: issue #173 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/173
- Type: feature (labels: enhancement, AI-initiated, UI)
- Spec: ai-docs/specs/interview-reschedule-and-cancel.md (playbook step 0; the issue body is the draft)

## Request
- A booked `Interview` is immutable once created: no endpoint, service method or UI changes its date, interviewers or existence. A candidate who asks to move Tuesday to Thursday has nowhere to go.
- The documented "re-schedule" (transition 31, Interview Completed 8 -> Interview Scheduled 3) books a *new round* and is gated on a submitted evaluation, so an un-held interview can never reach it. It stays as-is; it is not a reschedule.
- Add: edit a scheduled interview in place (date/time, duration, interviewers, types, notes), cancel it with a reason, notify the affected interviewers (in-app + email + Slack + .ics), and leave a readable trace on the candidate timeline.
- The issue carries a full verified design: see its sections Data model / API / Timeline trace / Calendar invites / Notifications / Frontend / Rules and edge cases / Tests.

## Decisions
- (carried from the issue, "Decisions already taken") Dedicated endpoints, not a 3 -> 3 self transition; candidate stage unchanged on reschedule; cancel returns the candidate to Call for Interview via new transition Id 50; `Interview.Status` + append-only `InterviewEvent`; a submitted evaluation blocks both (409); dropping a drafting interviewer deletes the draft; persist `SEQUENCE` and add a `METHOD:CANCEL` path, `PUBLISH -> REQUEST` deferred.
- Deliver the whole issue as one work item on one branch/PR? -> Yes. A slice that moves the date in-app without the calendar/email half leaves every interviewer's calendar on the old time, which is the failure the issue exists to fix.
- The issue's 3 open questions? -> All three as recommended: no auto-cancel on reject/discontinue (separate issue), no `Completed` value on `Interview.Status` (completion stays candidate-driven per `CandidateService.cs:387-394`), no optimistic-concurrency check on reschedule.
- Playwright coverage? -> Yes, add an e2e spec for the reschedule flow on top of the issue's unit/integration list (user chose this over the recommendation of hand-verification only).
- Verified at INTAKE against the code: `Models/Interview.cs` has no Status/UpdatedAt/Notes; `InterviewsController` has 4 GETs + `PUT /{id}/evaluation` only; `CalendarInvite.cs` hardcodes `SEQUENCE:0` (line 60) and `METHOD:PUBLISH` (line 54).

## Out of scope
- Notifying the candidate (no candidate-facing email path exists; `NotifyAsync` takes a userId).
- Availability/conflict checks, timezone handling.
- Auto-cancelling live interviews when a candidate is rejected (right end state, separate issue).
- Switching the `.ics` from `PUBLISH` to `REQUEST` (reverses the documented decision at `CalendarInvite.cs:45-47`).

## Follow-ups
- The "dropping a submitted interviewer -> 400" guard in `RescheduleAsync` is unreachable while the submitted-evaluation 409 refuses the whole reschedule. Kept as defence in depth, commented as such. The issue's rules table listed both without noticing the overlap.
- `.ics` cancellations are best effort: the original invite is `METHOD:PUBLISH` with no `ATTENDEE`, so Gmail/Outlook may not remove the event. Fixing it means `PUBLISH -> REQUEST` (reverses `CalendarInvite.cs:43-47`), deliberately deferred.
- Issue open questions 1-3, all deferred by decision: auto-cancel live interviews on reject/discontinue; `Interview.Status = Completed`; optimistic concurrency on reschedule.
- `POST /api/candidates` cannot be used by e2e to fabricate a candidate: it is the import path and rejects a CV file with no upload session. The new spec drives an existing booking and restores it instead.
