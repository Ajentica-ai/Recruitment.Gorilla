# Analytics: ?roleId= replaces a Recruiter's scope instead of narrowing it
- Source: issue #96 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/96
- Type: bug (label: bug)

## Request
- Issue claims `AnalyticsService.GetSummaryAsync` used `if (roleId) ... else if
  (scope) ...`, so a supplied `roleId` replaced the Recruiter's access scope
  instead of narrowing it - letting a Recruiter read analytics for any role.
- Suggested fix: two independent filters (AND'd), matching
  `DashboardService.cs`'s pattern; add a test for an unassigned-Recruiter +
  roleId case expecting `TotalCandidatesInPeriod == 0`.

## Finding (CLARIFY)
Already fixed. `AnalyticsService.cs:53-64` already applies the scope filter
and the `roleId` filter as two independent `if` blocks (not if/else-if),
exactly the suggested pattern, with the comment "The role filter narrows the
caller's scope; it never widens it." Landed in commit `9fe7f1b` ("Scope
analytics workloads and role filter to the caller - #10"), dated 2026-10-02,
already on `develop`. `AnalyticsController.GetSummary` wires `OwnerScope`
(null for Admin+, else the caller's id) into it correctly.
`AnalyticsServiceTests.Role_filter_narrows_a_recruiters_scope_instead_of_replacing_it`
already proves a Recruiter querying an unassigned role sees only their own
candidate (1), not the role's full count (3) that an Admin sees - exactly the
narrowing behavior #96 asks for.

Issue #96 appears to have been filed against a since-fixed state, or the fix
landed under #10 without #96 being linked/closed.

## Decisions
- Close #96 as already-fixed with an explanatory comment, no code change -> user confirmed.

## Out of scope
- n/a - no code change identified as needed.

## Follow-ups
- none
