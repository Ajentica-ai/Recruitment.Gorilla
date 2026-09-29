# Spec — Interview Assignment, Notifications & Evaluation

**Status:** Implemented
**Author:** AI agent
**Date:** 2026-07-09 (refined 2026-07-09)

> **Refinement (2026-07-09):** interviewer names now appear on the "Interview Scheduled" status
> history entry and link to `/interviews/:id`; the read-only candidate profile was modernized
> (icon links + colorful skill badges); the evaluation form dropped **Interview Round** and
> **Additional comments**; recommendation options are now **Recommended / Hold / Reject / Other**
> (Other requires free text, stored in `RecommendationOther`). Migration `RefineEvaluationFields`.

## 1. Summary
When a candidate moves to **Interview Scheduled**, the recruiter also assigns one or more
application users as interviewers. Assigned users are notified in-app, see the interview on
their dashboard, and can open it to view the candidate read-only alongside an Interview
Evaluation Form (draft → submit, locked after submit).

## 2. Motivation
Interviews were only a status + date. Teams need to assign interviewers, notify them, and
capture structured scorecards (per the provided Interview Evaluation Form PDF) for hiring
decisions.

## 3. Scope
**In scope:** interviewer assignment on Interview Scheduled; in-app notifications (bell +
dashboard); interview detail with read-only candidate + evaluation form; per-interviewer
evaluations with submit-lock; Admin+ can read all evaluations for an interview.
**Out of scope / later:** email notifications; editing a submitted evaluation; aggregate
scorecards/averages; per-candidate assignment outside the scheduling flow; PDF export.

## 4. Data model changes
New tables (migration **`AddInterviewsEvaluationsAndNotifications`**): `Interviews`,
`InterviewInterviewers` (PK `(InterviewId,UserId)`), `InterviewEvaluations` (unique
`(InterviewId,InterviewerUserId)`), `InterviewEvaluationItems` (unique
`(InterviewEvaluationId,CriterionKey)`), `Notifications` (index `(UserId,IsRead)`).
Criterion keys are fixed in `Models/EvaluationCriteria.cs`. Full detail in
[../data-model.md](../data-model.md). No changes to existing tables.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/candidates/{id}/status` | CanWriteCandidate | `StatusChangeDto` (+`InterviewerUserIds`) | `StatusHistoryDto` | Interview Scheduled now requires ≥1 active interviewer; creates Interview + notifications |
| GET | `/api/interviews/assignable-users` | any | — | `AssignableUserDto[]` | active users |
| GET | `/api/interviews/mine` | any | — | `MyInterviewDto[]` | caller's assigned interviews + eval state |
| GET | `/api/interviews/{id}` | assigned or Admin+ | — | `InterviewDetailDto` | else 404 |
| PUT | `/api/interviews/{id}/evaluation` | assigned | `UpsertEvaluationDto` | `InterviewEvaluationDto` | 409 if already submitted; 400 on invalid keys/ratings; on `Submit` notifies Admin+ and candidate-visible Recruiters (issue #76) |
| GET | `/api/notifications` | any | — | `NotificationListDto` | items + unreadCount |
| POST | `/api/notifications/{id}/read` · `/read-all` | any | — | 204 | caller-scoped |

## 6. Backend design
- `CandidateService.ValidateStatusChangeAsync` requires interviewers for Interview Scheduled;
  `AddStatusAsync(…, currentUserId)` creates the `Interview` (StatusHistory nav → FK),
  `InterviewInterviewer` rows and one `Notification` per interviewer.
- `InterviewService`: `GetMineAsync`, `GetDetailAsync(id,userId,isAdmin)` (access = assigned OR
  Admin+; candidate snapshot via `CandidateService.GetByIdAsync`; all evals for Admin+),
  `UpsertEvaluationAsync` (assigned-only; validates against `EvaluationCriteria`; submit-lock →
  Conflict), `GetAssignableUsersAsync`.
- **On submit only**, `UpsertEvaluationAsync` calls `NotifyEvaluationSubmittedAsync`: one in-app
  notification (no email) per active recipient, linking to `/candidates/{id}/evaluations`.
  Recipients are every SuperAdmin/Admin plus the Recruiters who can see that candidate (own it,
  or assigned on its applied role — the same rule as `CandidateService.ApplyAccess`), minus the
  submitter, who may hold Admin and be the interviewer at once. The recruiter scoping is
  deliberate: the report route is owner-scoped for recruiters, so an unscoped fan-out would
  hand the rest of them a link that 404s. Draft saves notify nobody.
- `NotificationService`: caller-scoped list/unread/mark-read. Both controllers `[Authorize]`.
  See [../backend.md](../backend.md).

## 7. Frontend design
- `types/index.ts` + `services/api.ts`: interview/notification types and functions;
  `StatusChangePayload.interviewerUserIds`.
- `CandidateDetailPage` AddStatus: interviewers `SearchableMultiSelect`.
- `NotificationBell` (navbar, `['notifications']` 60s poll); `MyInterviewsCard`
  (`['my-interviews']`) on the dashboard; `InterviewPage` (`/interviews/:id`) with
  `ReadOnlyCandidateProfile` + `EvaluationForm`, driven by `utils/evaluationCriteria.ts`.
  See [../frontend.md](../frontend.md).

## 8. Security & auth
- Interview read = assigned interviewer **or** Admin+ (bypasses recruiter owner-scope by design).
  The candidate **CV file** endpoint (`GET /api/candidates/{id}/cv/{fileId}`) honors the same rule:
  an assigned interviewer may stream the CV even when they don't own the candidate
  (`InterviewService.IsAssignedInterviewerForCandidateAsync`).
- Evaluation write = assigned interviewer only; locked once submitted. Evaluation visibility =
  author + Admin+. Notifications and "my interviews" are strictly caller-scoped by `UserId`.

## 9. Acceptance criteria / verification
- [x] Interview Scheduled without interviewers → 400; with valid interviewers → Interview +
      notifications created.
- [x] Assigned user: bell badge + `/interviews/:id` reachable; dashboard lists it.
- [x] Non-assigned non-admin → 404 on the interview; Admin+ can open any and see all evals.
- [x] Draft persists; submit locks (subsequent PUT → 409).
- [x] Submit raises one notification per Admin+/candidate-visible Recruiter, never for the
      submitter, never on a draft save (`InterviewServiceEvaluationTests`).
- [x] `dotnet build`, `dotnet ef database update`, `tsc --noEmit`, `lint` clean.

## 10. Open questions
- None. Future: email delivery for the submit notification, aggregate scorecards,
  editable/withdrawn submissions.
