# Dashboard Recommended section not updated after evaluation submit

- Source: issue #75 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/75
- Type: bug

## Request
- Interviewer submits an interview evaluation with recommendation "Recommended".
- Dashboard -> Recommended section does not show the candidate afterwards.
- Expected: it should reflect the new recommendation without manual refresh being the fix (i.e. the underlying data/computation should be correct and the UI should not be stale).

## Decisions
- Root cause: CurrentStatus (drives the dashboard tile) is separate from
  InterviewEvaluation.Recommendation; evaluation submit never touches status.
  The actual bug is that AddStatusModal and KanbanBoard's status-change
  mutations never invalidate the `['dashboard', ...]` query keys, so the
  dashboard goes stale after a status change -> confirmed by user.
- Scope: fix the cache-invalidation bug only. Auto-transitioning status from
  the evaluation recommendation is out of scope (separate feature decision)
  -> confirmed by user.

## Out of scope
- Auto-transitioning Candidate.CurrentStatus from InterviewEvaluation.Recommendation.

## Follow-ups
(none yet)
