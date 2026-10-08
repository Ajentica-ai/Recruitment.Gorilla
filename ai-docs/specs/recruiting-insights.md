# Spec — Recruiting Insights (analytics · search & export · scorecard roll-up)

**Status:** Draft
**Author:** AI agent
**Date:** 2026-08-16

Covers roadmap items **#5 (recruiting analytics)**, **#4 (search, filtering & export)** and
**#3 (aggregate scorecards)**, built in that order as three independent phases.

## 1. Summary

Three read-mostly capabilities on data the app already captures: recruiting metrics computed from
the status timeline, richer candidate filtering with CSV export and saved views, and a cross-
interviewer scorecard roll-up on the candidate profile.

## 2. Motivation

- **#5** — the dashboard shows counts but not the numbers that run a recruiting org: how long hiring
  takes, where candidates stall, which channels work. `StatusHistory.ChangedAt` has timestamped every
  stage change since day one, so this is computation over existing data, not new capture.
- **#4** — the candidate list filters on a name/email substring and one status. Recruiters cannot
  isolate a cohort, and there is no way to get data out.
- **#3** — per-interviewer evaluations are rich (12 rubric criteria, 1–5, plus a recommendation) but
  nothing aggregates them, so a candidate with three interviewers has three separate opinions and no
  combined view.

## 3. Scope

**In scope:** time-to-outcome and time-in-stage · funnel conversion · source effectiveness ·
interviewer turnaround · multi-filter candidate search · CSV export · saved views · cross-interviewer
scorecard roll-up with a disagreement flag.

**Out of scope / later:** bulk status change and bulk recruiter assignment (explicitly dropped — no
bulk writes at all) · Excel/XLSX (CSV only) · shared/team saved views · side-by-side candidate
comparison · archived-state filtering (no archive feature exists).

### Naming caveat, decided up front

**There is no "hired" state.** `Recommended` is the pipeline's positive terminal, and its only
outgoing transition is to `Discontinued`. So the metric is **time-to-recommendation**, not
time-to-hire, and every label must say so. Renaming it "time-to-hire" would report a number that
does not mean what a recruiter assumes. A true time-to-hire needs roadmap #12 (offer/hire states).

---

# Phase 1 — Recruiting analytics (#5)

## 4. Data model changes

No entity changes. **One migration, `AddAnalyticsIndexes`:**

- `StatusHistory (CandidateId, ChangedAt)` — every metric walks a candidate's history in date order,
  and today only the EF-generated FK index on `CandidateId` exists.
- `StatusHistory (ChangedAt)` — supports the reporting window filter.
- `InterviewEvaluation (IsSubmitted, SubmittedAt)` — for turnaround.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/analytics/summary` | **Admin+** | `?days=30\|90\|180` | `AnalyticsSummaryDto` | Windowed; invalid values clamp to 90 |
| GET | `/api/analytics/funnel` | **Admin+** | `?days=` | `List<FunnelStageDto>` | Reached-count + conversion per stage |
| GET | `/api/analytics/time-in-stage` | **Admin+** | `?days=` | `List<StageDurationDto>` | Median + mean days per status |
| GET | `/api/analytics/sources` | **Admin+** | `?days=` | `List<SourceOutcomeDto>` | Counts by source × outcome |
| GET | `/api/analytics/interviewer-turnaround` | **Admin+** | `?days=` | `List<InterviewerTurnaroundDto>` | Submitted vs pending, median hours |

**Auth is a deliberate change of level.** `DashboardController` is `[Authorize]` — every role,
including Interviewer, sees the org-wide figures. Analytics is org *performance* data (per-
interviewer turnaround names individuals), so it belongs behind `Roles.AdminOrAbove`, matching the
audit log. New `AnalyticsController`, not new actions on `DashboardController`, so the class-level
gate differs cleanly.

## 6. Backend design

New `Services/AnalyticsService.cs`. All five metrics derive from one windowed pull of
`(CandidateId, Status, ChangedAt)` ordered by candidate then time, plus candidate `CreatedAt` and
`SourceOptionId`.

**Compute in memory, not in SQL.** The UTC value converter added in `AppDbContext.ConfigureConventions`
stops EF translating member access on a `DateTime` column — `.Date`, `.Year`, `DateDiff` all throw
*"could not be translated"*. This already forced `DashboardService.GetApplicationsTrendAsync` to group
in memory. Project the raw columns out and compute deltas in C#. The `?days=` window bounds the row
count; the new composite index makes the pull an index range scan.

Metric definitions, stated precisely so the numbers are defensible:

- **Time-to-recommendation** — per candidate that reached `Recommended` in the window:
  `ChangedAt(Recommended) − CreatedAt`. Report **median** and mean; median is the headline, since a
  single stale candidate skews the mean badly. Report `n` alongside — a median over 3 candidates is
  not a statistic, and the UI must be able to say so.
- **Time-in-stage** — for consecutive history entries, `ChangedAt(next) − ChangedAt(current)`
  attributed to the *current* status. Candidates sitting in a stage now (no next entry) are
  **excluded** from the median and reported separately as "currently in stage", or a slow stage looks
  fast because only the ones that escaped are counted. This is the single easiest way to produce a
  misleading number here.
- **Funnel conversion** — for each status in `SortOrder`, the count of distinct candidates that ever
  reached it (from history, not `CurrentStatus`, so a candidate who has moved on still counts).
  Conversion = `reached(next) / reached(current)`. Because the pipeline is a configurable graph
  rather than a straight line, present it as reached-counts in pipeline order with the ratio between
  adjacent stages — do not claim it is a strict funnel.
- **Source effectiveness** — group by `SourceOptionId` × outcome bucket (positive terminal / negative
  terminal / in process). Candidates predating source tracking have `SourceOptionId = NULL` and must
  render as an explicit **"Not recorded"** row, never be dropped — otherwise percentages silently
  describe a subset.
- **Interviewer turnaround** — per interviewer: submitted count, pending count, and median hours
  from `Interview.ScheduledAt` to `InterviewEvaluation.SubmittedAt` for submitted ones. Pending =
  assigned via `InterviewInterviewer` with no submitted evaluation and the interview in the past.

## 7. Frontend design

New `pages/AnalyticsPage.tsx` at `/analytics`, added to `navRoutes.ts` gated on Admin+ (the existing
pattern for the Audit link). Reuses `components/dashboard/CountBarChart` and `TrendChart` rather than
adding a chart library. A window selector (30/90/180 days) drives one query key
`['analytics', metric, days]`.

Each metric card shows its `n`. Where `n` is small the card says "too few to be meaningful" instead
of printing a confident median over four candidates.

## 8. Security & auth

`[Authorize(Roles = Roles.AdminOrAbove)]` at class level. No owner scoping — these are org-wide
figures by definition, and the Admin+ gate is what makes that acceptable. Interviewer turnaround
names individuals, which is the specific reason this is not visible to all roles.

---

# Phase 2 — Search, filtering & export (#4)

## 4. Data model changes

New entity **`SavedCandidateView`**: `Id`, `UserId` (FK, cascade), `Name` (≤100, unique per user),
`QueryJson` (≤4000), `CreatedAt`, `UpdatedAt`. Personal to their owner.

Migration `AddSavedCandidateViews`, plus the filter indexes on `Candidates`:
`(CurrentStatus, CreatedAt)` and a non-unique `(Email)` — the latter fixes a pre-existing full scan
in `FindDuplicateAsync`, which runs on **every** candidate create.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/candidates` | CanWriteCandidate | `CandidateQuery` (query string) | `PagedResult<CandidateListItemDto>` | Extended, not replaced |
| GET | `/api/candidates/export` | CanWriteCandidate | same `CandidateQuery` | `text/csv` | Row cap 5000; audited |
| GET/POST | `/api/candidates/views` | CanWriteCandidate | `UpsertSavedViewDto` | `SavedViewDto` | Caller's own only |
| PUT/DELETE | `/api/candidates/views/{id}` | CanWriteCandidate | | | 404 if not the caller's |

## 6. Backend design

Replace `GetAllAsync`'s five positional parameters with a bound `CandidateQuery` record —
`Search`, `List<string>? Statuses`, `RoleAppliedOptionId`, `List<int>? SourceOptionIds`,
`List<int>? SkillOptionIds`, `bool? IsReferred`, `DateOnly? CreatedFrom/CreatedTo`, `Page`, `PageSize`
— with a `Normalized()` that trims, dedupes (cap 50 ids) and **clamps `PageSize` to 1–200**. That
clamp fixes a live issue: `?pageSize=100000` is currently accepted at every layer.

Three non-obvious mechanics:

1. **`accessUserId` stays a separate service parameter, never a property on the bound query.** On the
   query object a client could send `?accessUserId=` and read another recruiter's candidates.
2. **`[FromQuery]` is mandatory** on the controller parameter. Under `[ApiController]` a complex type
   is inferred as `[FromBody]`, and the GET then returns **415**.
3. **Axios must serialize arrays as repeated keys.** Its default emits `statuses[]=A`, which ASP.NET
   binds to nothing — the endpoint returns *unfiltered* results with no error. Set
   `paramsSerializer: { indexes: null }` once on the shared instance in `services/api.ts`. All
   existing call sites pass scalars, so this is safe.

**Export** reuses the same query and the same access predicate, so a Recruiter can only export what
they can see. Stream the CSV rather than buffering, cap at 5000 rows, quote and escape fields, and
guard against CSV injection by prefixing values beginning `= + - @` with an apostrophe. It emits
candidate PII, so record an audit entry (`Candidate.Exported`) with the filter and row count.

## 7. Frontend design

Keep the existing search box in `.data-toolbar` with instant apply — it is used far more than
anything else. Put the new filters in a **collapsible card below it** with an active-count badge; a
permanently-open filter panel would push the table below the fold on the most-used page.

Use draft-vs-applied state (the `applied` pattern in `AuditLogPage.tsx:29`) with explicit **Filter**
and **Reset** buttons — with eight controls, applying on change fires eight requests. Reset paging to
page 1 on every apply. Extract param building into `utils/candidateQuery.ts` so it can be unit-tested
independently of HTTP.

Statuses use `SearchableMultiSelect` over the status options, mapping ids → names at the call site;
do not add a string-id variant to `SearchableSelect`.

## 8. Security & auth

Export is the sensitive addition: same authorization and owner scoping as the list, capped, and
audited. Saved views are per-user and must 404 (not 403) on someone else's id, matching how the app
treats out-of-scope candidates.

---

# Phase 3 — Scorecard roll-up (#3)

## 4. Data model changes

None. Computed from existing `InterviewEvaluation` + `InterviewEvaluationItem`.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/candidates/{id}/scorecard` | **Admin+** | | `ScorecardDto` | 404 when fewer than 2 submitted evaluations |

## 6. Backend design

`InterviewService.GetScorecardAsync(candidateId)` aggregates **submitted evaluations only** across
all of the candidate's interviews — drafts are excluded, matching the existing submit-lock semantics.

Per criterion: mean, min, max, and count. Overall: mean `OverallRating` and the distribution of
`Recommendation`. **Disagreement flag** where `max − min ≥ 2` on a criterion or on the overall
rating — surfaced as "interviewers diverged here", which is the genuinely useful signal, since an
average of 3 hides a 1-and-5 split.

## 7. Frontend design

A "Combined scorecard" card on the candidate detail page, above the status timeline, rendered only
when the endpoint returns data. Criterion rows with the mean, the spread, and a divergence marker.

## 8. Security & auth

**Admin+ only, and this is a real constraint rather than a default.** `InterviewService.GetDetailAsync`
releases peer scores on a tight rule: Admin+ see every evaluation, while an interviewer sees their
peers' submitted ones **only once they have submitted and locked their own**, so nobody is anchored by
a colleague before writing their own verdict. It also withholds the candidate's status history from
non-admins, because `StatusHistoryDto.EvaluationSummaries` carries other rounds' ratings and
recommendations (issue #116). An average leaks the same information: an interviewer who knows
their own score and the mean over two evaluations can derive their colleague's exactly. Gating the
roll-up at Admin+ preserves the existing privacy property. If it is ever opened to interviewers, it
must be suppressed below ~3 evaluations — and even then it only shrinks the leak, so Admin+ is the
honest answer.

---

## 9. Acceptance criteria / verification

Per phase, following [feature-playbook.md](../feature-playbook.md):

- [ ] `dotnet build` clean (API stopped first); migrations apply cleanly
- [ ] `dotnet test` and `npm test` green; `npx tsc -b` clean
- [ ] **Phase 1** — service tests over seeded histories with known dates assert exact medians;
      candidates still in a stage are excluded from time-in-stage; `NULL` source appears as
      "Not recorded"; `ControllerAuthorizationTests` proves Recruiter and Interviewer get 403
- [ ] **Phase 2** — filters compose with the recruiter access predicate (a Recruiter filtering by
      status still cannot see another's candidate); `pageSize` clamps; the inclusive to-date includes
      the whole final day; `utils/candidateQuery.test.ts` guards the array-serialization contract;
      export respects scoping, caps rows, escapes injection-prone values, and writes an audit row
- [ ] **Phase 3** — roll-up ignores drafts; divergence flag fires on a 1-vs-5 split; Recruiter and
      Interviewer receive 403
- [ ] Manual pass through the proxy for each phase: unauthorized → 401, wrong role → 403, happy path

## 10. Open questions

1. **Analytics window default** — 90 days assumed. If typical time-to-recommendation exceeds that,
   the headline metric will be computed over very few candidates.
2. **Time-in-stage across re-entry** — a candidate can return to `Interview Scheduled` after
   `Interview Completed`. Current assumption: each visit counts separately. The alternative (summing
   per candidate per stage) gives a different answer; worth confirming with whoever reads the number.
3. **Export format** — CSV assumed. XLSX would need a new dependency (ClosedXML/EPPlus).
4. **Saved-view sharing** — personal-only assumed; team sharing needs a visibility field and a
   permission rule.
5. **Source-effectiveness sparsity** — only candidates created after source tracking shipped have a
   source, so this chart is mostly "Not recorded" for a while. Consider hiding it until coverage is
   reasonable, rather than showing a chart that looks broken.
