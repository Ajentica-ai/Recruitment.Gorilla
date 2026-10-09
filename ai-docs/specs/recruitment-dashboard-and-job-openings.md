# Spec — Recruitment Dashboard & Active Job Openings

**Status:** Implemented
**Author:** AI agent
**Date:** 2026-07-09 (revised 2026-07-11)

> **Revision (2026-07-11):** the single `GET /api/dashboard` payload was **split** — KPIs, status
> breakdown, applications trend (with a `?days=` 7/30/90 toggle), and job openings are now **org-wide,
> all-roles** endpoints (`/api/dashboard/kpis|status-breakdown|applications-trend|job-openings`);
> `GET /api/dashboard` keeps only the owner-scoped by-role/top-skills/upcoming/activity remainder.
> The **pipeline funnel was removed** (redundant with the donut); **upcoming interviews** now come
> from the `Interviews` table (pending only); Active Job Openings shows the **End date** + a
> "Closing soon" badge and hides roles past their End date. See
> `job-openings-and-role-hierarchy.md` and the reference docs.

> **Revision (2026-10-10, RG-134, issue #134):** the page was redesigned action-first and mobile-first.
> The donut is replaced by a stacked pipeline bar with drill-through stage rows; "My interviews" and
> "Upcoming interviews" merge into one **Up next** card (Mine / Team); the job openings table became
> **Open roles** cards sorted by closing date; by-role and top skills share one **Insights** card;
> recent activity groups by day and folds runs of changes. The API gained additive fields only:
> `DashboardKpisDto.NewPrevWeek / RecommendedThisWeek / RejectedThisWeek` and
> `GET /api/dashboard/applications-summary`. The current layout is documented in
> `ai-docs/frontend.md` (Dashboard section); this spec's component names below are historical.

## 1. Summary
A dashboard landing page (`/`) that summarizes the pipeline for the signed-in user: KPI stat cards, a pipeline funnel + status donut, an applications trend, by-role/top-skill breakdowns, upcoming interviews, a recent-activity feed, and an **Active Job Openings** table. Job openings reuse the existing "Roles applied" lookup (each active role is an open position with posting metadata); applicants are derived by role.

## 2. Motivation
The app landed on a plain candidate table. Admins/recruiters need an at-a-glance view of pipeline health and open positions, styled after the reference SmartHR recruitment dashboard. Rather than introduce a full jobs domain, we extend the existing role lookup so openings are managed in one place.

## 3. Scope
**In scope:**
- Read-only `GET /api/dashboard` aggregation (owner-scoped) + `DashboardPage` with charts (recharts), KPI cards, lists.
- "Stage Performance"-style KPI cards with per-tone accent + hover recolor.
- Active Job Openings from active `RoleAppliedOptions` + new posting fields (Location, Department, Priority, PostedDate), editable on the Configuration page.
- Dashboard as the landing route; Candidates moves to `/candidates`.

**Out of scope / later:**
- A separate `JobOpening` entity, per-candidate assignment to a specific opening, multiple openings per role.
- Requisitions/offers, email notifications, CSV/PDF export, a dashboard date-range picker.

## 4. Data model changes
No new tables. Extends `RoleAppliedOption` with nullable `Location` varchar(100), `Department` varchar(100), `Priority` varchar(20), `PostedDate` datetime. Migration: **`AddJobOpeningFieldsToRoleAppliedOption`**. Dashboard figures are aggregated over Candidates / StatusHistories / RoleAppliedOptions / CandidateSkills. See [../data-model.md](../data-model.md).

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/dashboard` | required (all roles) | — | `DashboardDto` | Owner-scoped like the candidate list |
| GET/POST | `/api/config/roles` | Admin+ | `UpsertRoleAppliedOptionDto` (now incl. Location/Department/Priority/PostedDate) | `RoleAppliedOptionDto` (same new fields) | Existing endpoint, extended |
| PUT/DELETE | `/api/config/roles/{id}` | Admin+ | `UpsertRoleAppliedOptionDto` | `RoleAppliedOptionDto` | Existing endpoint, extended |

`DashboardDto` = `{ kpis, statusBreakdown[], byRole[], topSkills[], applicationsTrend[], upcomingInterviews[], recentActivity[], activeJobOpenings[] }`; `JobOpeningDto = { id, title, location?, department?, priority?, postedDate, applicants }`.

## 6. Backend design
- `DashboardController` (`[Authorize]`) computes `ReadOwnerScope` (same rule as `CandidatesController`) → `DashboardService.GetAsync(ownerUserId)`.
- All aggregations are owner-scoped IQueryables. Terminal status sets are `HashSet<string>` of exact seeded strings. Trend is zero-filled in C#. Job openings = active roles projected to `JobOpeningDto`; applicants derived by matching `RoleAppliedOptionId`.
- **MySQL/Pomelo:** group by scalar FKs then resolve names from a dictionary (grouping by a joined navigation like `SkillOption.Name` is untranslatable).
- `ConfigurationService` reads/writes the new role fields (trim-to-null). See [../backend.md](../backend.md).

## 7. Frontend design
- `types/index.ts`: `DashboardData`, `DashboardKpis`, `StatusCount`, `NameCount`, `TrendPoint`, `UpcomingInterview`, `ActivityItem`, `JobOpening`; `RoleAppliedOption`/`UpsertOptionPayload` gain the optional job fields.
- `api.ts`: `getDashboard()`.
- `pages/DashboardPage.tsx` (`useQuery(['dashboard'])`) + `components/dashboard/*` (`KpiCard`, `kpiIcons`, `PipelineFunnelChart`, `StatusDonutChart`, `TrendChart`, `CountBarChart`, `ActiveJobOpeningsTable`) + `utils/chartColors.ts`.
- Routing: `/` → `DashboardPage`, add Dashboard nav link; Candidates at `/candidates`.
- `ConfigurationPage` Roles section gains `jobFields` (Location/Department/Priority/Posted date). Chart/KPI/priority colors are CSS tokens in `index.css` (light + dark). Dependency: **recharts**. See [../frontend.md](../frontend.md).

## 8. Security & auth
- Dashboard is `[Authorize]` (all roles) but **owner-scoped**: recruiters see only their own candidates' figures; SuperAdmin/Admin see all. (Roles later revised — see `job-openings-and-role-hierarchy.md`; the former Viewer is now Interviewer.) Config role writes remain Admin+.

## 9. Acceptance criteria / verification
- [x] `GET /api/dashboard` returns all sections; KPI total equals `/api/candidates` total; trend has 30 points; breakdown sums to total; interviews are future-only.
- [x] Recruiter vs Admin see correctly scoped numbers.
- [x] Dashboard renders all widgets; charts + KPI cards recolor on theme toggle; KPI card hover recolors/lifts.
- [x] Editing a role's Location/Department/Priority/Posted date shows it in the Active Job Openings table; applicants reflect candidates with that role.
- [x] `npx tsc --noEmit`, `npm run lint`, and `dotnet build` clean.

## 10. Open questions
- None. Future: promote to a first-class `JobOpening` entity if multiple openings per role or per-opening applications are needed.
