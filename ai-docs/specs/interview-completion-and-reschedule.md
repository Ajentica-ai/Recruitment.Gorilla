# Spec — Interview Completion Summary, Re-schedule & Interviewer Notes

**Status:** Implemented
**Author:** AI agent
**Date:** 2026-07-12

> **Revision (2026-07-13):** the per-interviewer summary is no longer baked into the entry's comment
> as text. `StatusHistoryDto.EvaluationSummaries` now carries a **live, structured** list
> (`EvaluationSummaryDto`: interviewer name, overall rating, recommendation + Other, submitted date)
> resolved from the linked interview's submitted evaluations, rendered as **cards** on the timeline
> (`components/StatusTimeline.tsx`). `AddStatusAsync` only sets `StatusHistory.InterviewId`; the
> frontend `cleanComment` strips any legacy "— Interview evaluations —" text from old comments.
> Because evaluations are submit-locked, live == the point-in-time snapshot in practice.

## 1. Summary
Closes the interview loop around the **Interview Completed** status: the timeline entry links to the
interviewers' evaluations (Admin+ only) and carries a snapshot summary (average + recommendation per
interviewer); the workflow gains a path back to **Interview Scheduled** for a second round; and a
recruiter can leave notes that the assigned interviewers see on the interview page.

## 2. Motivation
Today the loop ends abruptly. From an **Interview Completed** entry there is no way to reach the
evaluations, the scores/recommendations never surface on the candidate timeline, there is **no
transition back to Interview Scheduled** (a second interview round is impossible), and nothing lets
the recruiter brief the interviewers before an interview. This makes the completed status a
dead-end and hides the hiring signal it should carry.

## 3. Scope
**In scope:**
- Gate: **Interview Completed** is blocked until **≥1 assigned interviewer has submitted** an evaluation.
- On completion, snapshot a per-interviewer summary (name · Overall X/5 · recommendation · date) into
  the entry's comment.
- Link the completed entry to `/interviews/:id`, **visible only to Admin+** (who alone may read all
  evaluations).
- New `Interview Completed → Interview Scheduled` transition enabling a fresh interview round.
- Reuse the **scheduled** entry's comment as recruiter **notes for interviewers**, surfaced on the
  interview page.

**Out of scope / later:** editable/withdrawn summaries; recomputing the summary live into the
timeline after later submissions (the Admin+ link already shows live data); email notifications;
aggregate cross-interview scorecards; a dedicated notes column (intentionally reusing the comment).

## 4. Data model changes
Migration **`AddInterviewCompletionLinkAndReschedule`** (name TBD):
- **`StatusHistory.InterviewId`** — new nullable FK → `Interviews`, `OnDelete: SetNull`, with a
  `Interview? Interview` nav. Set only on the **Interview Completed** entry. This is a *second,
  independent* relationship from the existing `Interview.StatusHistoryId` (→ scheduled entry);
  configured as its own `HasOne(s => s.Interview).WithMany().HasForeignKey(s => s.InterviewId)
  .OnDelete(SetNull)`. Both cross-links are `SetNull`, so no cascade cycle.
- **New `StatusTransition`** seed row `Interview Completed (8) → Interview Scheduled (3)` (Id 31),
  added to `HasData` and inserted by the migration for existing DBs.

No other schema changes. The interviewer note reuses `StatusHistory.Comment` (no column).
Full detail to be reflected in [../data-model.md](../data-model.md).

## 5. API contract
No new endpoints or DTO shape changes on the request side. Behavior/field changes:

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/candidates/{id}/status` | CanWriteCandidate | `StatusChangeDto` | `StatusHistoryDto` | **Interview Completed** now 400s unless the latest interview has ≥1 submitted evaluation; on success the entry's `Comment` gets the appended summary and `InterviewId` is set. **Interview Scheduled** is now reachable from Interview Completed (re-schedule); its optional `Comment` is the interviewer note. |
| GET | `/api/candidates/{id}` | owner/Admin+ | — | `CandidateDetailDto` | `StatusHistory[].InterviewId` is populated for Interview Completed entries (via the new column) as well as scheduled entries (existing reverse-lookup). |
| GET | `/api/interviews/{id}` | assigned or Admin+ | — | `InterviewDetailDto` | gains **`Notes`** = the scheduled entry's comment. |

## 6. Backend design
- **`CandidateService.ValidateStatusChangeAsync`** — extend the `InterviewCompleted` branch: load
  the candidate's **latest interview** (most recent by `CreatedAt`) with its evaluations; if none is
  `IsSubmitted`, return *"Interview Completed requires at least one submitted interviewer
  evaluation."* Existing "requires Interview Scheduled in history" + "requires a comment" rules stay.
- **`CandidateService.AddStatusAsync`** — when `dto.Status == InterviewCompleted`: load the latest
  interview with submitted `Evaluations` → `Items` + `InterviewerUser`; a private helper
  `BuildEvaluationSummary(Interview)` produces lines *"{name} — Avg {X.X}/5 · {recommendation}
  (+Other text) · submitted {date}"* (mean of each evaluation's item ratings). Append the block to
  the user's `entry.Comment` and set `entry.InterviewId = interview.Id`.
- **`ToStatusHistoryDto`** — set the DTO interview id to `interview?.Id ?? s.InterviewId` so
  completed entries carry their link; scheduled entries keep the reverse-lookup + interviewer list.
- **`InterviewService.GetDetailAsync`** — add `.Include(i => i.StatusHistory)` and map
  `interview.StatusHistory?.Comment` into new `InterviewDetailDto.Notes`.
- Controller unchanged: a non-null validation error already maps to **400**. Log nothing new beyond
  the existing status-change audit line. See [../backend.md](../backend.md).

## 7. Frontend design
- **`types/index.ts`** — `InterviewDetail` gains `notes: string | null`. `StatusHistoryEntry.interviewId`
  already exists; no `api.ts` change.
- **`StatusTimeline.tsx`** — add a `canViewEvaluations: boolean` prop; on an entry where
  `status === 'Interview Completed' && interviewId && canViewEvaluations`, render a
  **"View interview evaluations →"** `<Link to={/interviews/${interviewId}}>`. Render the comment
  with `white-space: pre-line` so the appended summary's line breaks display.
- **`CandidateDetailPage.tsx`** — pass `canViewEvaluations={isAdminOrAbove}` (from `useAuth()`) to
  `StatusTimeline`. In **AddStatus**, when `status === 'Interview Scheduled'`, relabel the optional
  comment field to **"Notes for interviewers (optional)"** with helper text *"Shared with the
  assigned interviewers on the interview page."* (payload unchanged).
- **`InterviewPage.tsx`** — when `data.notes` is present, render a **"Notes from the recruiter"**
  card above the read-only profile (left column).
- Re-schedule needs no new UI: once `8 → 3` exists, `getNextStatusOptions` offers Interview
  Scheduled from Interview Completed and the existing interviewer/date/notes fields create a new
  interview. Invalidate `['candidate', id]`, `['status-options','next',id]`, `['notifications']`,
  `['my-interviews']` as today. See [../frontend.md](../frontend.md).

## 8. Security & auth
- The **evaluations link** is client-gated to `isAdminOrAbove`. On the backend, `AllEvaluations` from
  `GET /api/interviews/{id}` goes to Admin/SuperAdmin always, and to an assigned interviewer only once
  they have submitted and locked their own (submitted peers only, never drafts, never their own); a
  non-admin who follows a crafted URL gets 404 if unassigned, so no new exposure.
- The same endpoint returns the candidate **without** their status history for non-admins: the timeline
  carries every status comment and, via `EvaluationSummaries`, other rounds' ratings and
  recommendations, which would route around the rule above (issue #116).
- The completion **gate** and **summary** run server-side in `CandidateService`; the summary is
  built only from submitted evaluations. `InterviewDetailDto.Notes` is returned under the existing
  assigned-or-Admin+ access check — unassigned non-admins already 404.
- No new input surface: the note reuses the validated status `Comment`; `InterviewId` is
  server-assigned, never client-supplied.

## 9. Acceptance criteria / verification
- [ ] Migration: stop API → `dotnet ef migrations add …` → `dotnet build` → `database update` →
      restart. `dotnet build`, `tsc --noEmit`, `oxlint`, `npm run build` all clean.
- [ ] Candidate at Interview Scheduled with **no** submitted evaluation → Interview Completed 400s;
      after one interviewer submits → completion succeeds.
- [ ] Completed entry shows the user comment **plus** per-interviewer summary
      (name · Overall X/5 · recommendation · date).
- [ ] As Admin/SuperAdmin a **"View interview evaluations →"** link opens `/interviews/:id` with all
      evaluations; as Recruiter/Interviewer the link is **absent**.
- [ ] From Interview Completed the status dropdown offers **Interview Scheduled**; scheduling creates
      a new interview (new `/interviews/:id`, new notifications); the candidate can be completed again.
- [ ] Scheduling with "Notes for interviewers" text → the assigned interviewer sees a **"Notes from
      the recruiter"** card on `/interviews/:id`; blank → no card.

## 10. Open questions
- **Rating basis:** the summary line shows the evaluation's **Overall rating** (1–5). The rubric
  (per-criterion) average is not shown — revisit if reviewers want it too.
- **Snapshot vs live:** the timeline summary is a snapshot at completion; evaluations submitted
  afterward appear only via the Admin+ link. Acceptable per the completion gate (≥1 already
  submitted). Revisit if a live-refreshed timeline summary is wanted.
