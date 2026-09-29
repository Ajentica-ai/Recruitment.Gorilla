# Notify Admin and Super Admin when an interviewer submits an evaluation

- Source: issue #76 https://github.com/tahmidsparrow/Recruitment.Gorilla/issues/76
- Type: bug

## Request
- An interviewer submits an interview evaluation; Admin and Super Admin get no notification.
- Expected: on successful submit, those roles are notified.
- Root cause: `InterviewService.UpsertEvaluationAsync` never calls `NotificationService`.
  The only trace is the `Interview.EvaluationSubmitted` audit entry written by the controller.

## Decisions
- Channel? → In-app only. Every interviewer on every interview submits, so an email per
  submit would be noisy. `NotifyAsync` supports this by omitting the email arguments.
- Recipients? → Admin + SuperAdmin + Recruiters (user widened this beyond the issue),
  active only, excluding the submitting user (an Admin can also be an assigned interviewer).
- Recruiter scope? → Only Recruiters who can see the candidate (own it, or are an assigned
  recruiter on its applied role). `/candidates/{id}/evaluations` is owner-scoped for
  Recruiters, so an unscoped fan-out would dead-link for the rest.
- Link target? → `/candidates/{id}/evaluations`, the candidate evaluation report.
- Tests? → Backend regression tests in `InterviewServiceEvaluationTests.cs`.

## Out of scope
- Email notification and any `EmailTemplates` addition.
- Frontend changes: `NotificationBell` already renders whatever the API returns.
- Notifying on draft saves.

## Follow-ups
- (none yet)
