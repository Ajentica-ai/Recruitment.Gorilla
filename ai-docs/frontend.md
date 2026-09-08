# Frontend

React 19 + TypeScript + Vite. Root: `client/`.

## Structure
| Path | Purpose |
|---|---|
| `src/main.tsx` | Entry; wraps app in `QueryClientProvider`; imports Figtree, Bootstrap CSS + `index.css`. |
| `src/App.tsx` | Router, `AuthProvider`, `ProtectedLayout` (auth guard only — chrome lives in `AppShell`), routes. |
| `src/navRoutes.ts` | **Single source for the sidebar items and topbar titles** — path, label, lucide icon, description, role gate. |
| `src/auth/AuthContext.tsx` | Auth state, login/logout, silent session restore. |
| `src/services/api.ts` | Typed Axios layer + auth interceptors (the only HTTP caller). |
| `src/types/index.ts` | Shared types mirroring API DTOs. |
| `src/pages/` | `DashboardPage`, `LoginPage`, `UploadPage`, `CandidatesPage`, `CandidateDetailPage`, `CandidateEvaluationReportPage`, `InterviewPage`, `ConfigurationPage`, `UsersPage`, `AuditLogPage`, `ChangePasswordPage`. |
| `src/pages/configuration/` | The Configuration tabs: `JobOpeningsTab`, `OptionChipsTab`, `EmailSettingsTab`. |
| `src/components/shell/` | App chrome: `AppShell` (layout + sidebar state, skip link, `<main>`), `SidebarNav`, `TopbarTitle`, **`UserMenu`** (topbar avatar → account menu). |
| `src/components/ui/` | Shared primitives: **`Page`**, **`SectionCard`**, `PageHeader`, `Pagination`, `EmptyState`, `ConfirmModal`, **`Loading`** (`LoadingPanel`, `Skeleton*`), `Tabs` + `useTabs`. |
| `src/components/` | `BulkUploader`, `CandidateForm`, `StatusTimeline`, `SearchableSelect`, `StatusBadge`, **`ThemeMenu`**, `ToastStack`, `RequireRole`, `NotificationBell`, `ReadOnlyCandidateProfile`, `EvaluationForm`. |
| `src/components/dashboard/` | Dashboard widgets: `KpiCard`, `kpiIcons`, `StatusDonutChart`, `TrendChart`, `CountBarChart`, `ActiveJobOpeningsTable`, `MyInterviewsCard`, `DashboardHero`. |
| `src/utils/` | `statusColors.ts` (status → tone class); `chartColors.ts` (chart colors from status tokens + chrome read off the design tokens); `evaluationCriteria.ts` (interview-form catalog — keys match the backend); `skillColors.ts` (stable hash of a skill name → badge class); `jobStatus.ts` (job-opening lifecycle); `initials.ts`. |
| `src/styles/tokens.css` | **Design tokens — the single source of visual truth.** |
| `src/index.css` | Bootstrap bridge → Prism semantic layer → app-specific components. |
| `public/logo.png` | Brand logo. |
| `vite.config.ts` | Dev server host + `/api` proxy. |

## Design system (Prism)

The UI follows the **Ajentica Prism/Pulse** dashboard so the two products read
as one. `styles/tokens.css` holds the palette, radius/space/type scales and the
dark-mode overrides; `index.css` maps those onto Bootstrap's `--bs-*` so
react-bootstrap components inherit the design with no JSX change, then adds a
semantic class layer that pages are written against.

- **Never hardcode a colour.** Reference a token. The `--ms-*` legacy aliases
  are **gone** — every reference was rewritten to the canonical token it already
  resolved to. Don't reintroduce a second vocabulary: a colour has one name.
- **Never hardcode a spacing value either.** `tokens.css` carries a 4px-based
  `--space-1…--space-10` scale plus `--card-pad`, `--stack-gap` and
  `--space-page`. Reach for a token, not a raw px value and not a Bootstrap
  `m-*`/`p-*` utility.
- **Cards are flat**: `--radius-card` (14px), 1px border, **no shadow**; hover
  changes the border. Shadows are reserved for things that float (dropdowns,
  modals, toasts).
- **Icons are `lucide-react`**, size 16 (20 in a KPI chip), `strokeWidth` 1.5–1.75.
  Don't hand-roll SVGs or use emoji.
- **Semantic classes** to reach for before stacking Bootstrap utilities:
  `.rg-content`, `.page-stack`, `.grid-2`/`.grid-3`/`.kpi-grid`, `.card-stack`,
  `.page-header`/`.page-eyebrow`, `.section-head`/`.section-title`,
  `.pulse-card` (+ `__head`/`__body`/`--flush`),
  `.metric-label`/`.metric-value`, `.table-wrap`/`.table-cards`/`.table-link`,
  `.row-actions`, `.badge-pill` + `.badge-success|warning|danger|info|neutral|accent|outline`,
  `.empty-state`, `.skeleton`, `.data-toolbar` (+ `__search`/`__field`/`__end`),
  `.search-field`, `.segmented`, `.page-bar`, `.admin-tabs`, `.avatar`/`.who-cell`,
  `.cat-chip`, `.alert-*-soft`, `.form-stack`/`.form-actions`/`.form-section`,
  `.list-row`, `.feed-list`/`.feed-row` (+ `.feed-date`), `.timeline`, `.token`.

### The page stack — the app's spacing rule

**A page is a vertical stack of sections separated by `--stack-gap`, and
`<Page>` is what applies it.** Every page's root element is `<Page>` (or, in a
tab, `TabPanel`, which is a stack too). Sections inside a page **must not** set
their own `mb-3`/`mb-4` to separate themselves from what follows.

This is load-bearing, not cosmetic. The gap used to live on `.rg-content` in
the shell, where it did nothing: every page returned a single wrapper element,
so `.rg-content` had exactly one flex child and there was never a second child
for the gap to fall between. Page headers sat flush against filter bars, filter
bars flush against tables, pagers flush against those — and pages compensated
with ad-hoc margins wherever someone noticed, which is why the rhythm differed
page to page. Putting the gap on the page's own root puts it where the siblings
actually are.

Corollary: **use `.grid-2`/`.grid-3`/`.kpi-grid`, not Bootstrap `Row`/`Col`,
for page-level layout.** `Row`'s negative gutter margins have to be cancelled by
matching padding on every child, and they made the gap between two cards
(`g-3`) a different number from the gap between the sections holding them
(`mb-4`). The grids take their `gap` from the same scale as the stack.

### Feed lists

**A dashboard feed is a capped scroll area of rows that each lead with a 40px
tile** — `.feed-list` > `.feed-list__items` > `.feed-row`. Used by "My
interviews" (`MyInterviewsCard`) and "Recent activity" (`DashboardPage`'s
`ActivityRow`); it replaced the flush `.list-row` lists both carried.

- **Why capped.** Every assignment or status change added a row, so a busy
  dashboard pushed the charts below the fold. `--feed-rows-visible` (default 3)
  drives `max-height`, so a card is a fixed block however much history sits
  behind it. A wrapped name leaves the third row clipped — that is the intended
  cue that the list continues, not a bug.
- **Why a lead tile.** The identifying detail was the smallest text on the row.
  It now leads: `.feed-date` (month over day) for a scheduled interview,
  the shared `.avatar` for a person. That tile is the only part that differs
  between the two feeds; both are sized to 40px so the rows share one rhythm.
- **Rows are gap-separated and lift on hover**, not divided by rules — with the
  tiles giving the list a left edge, borders on top of that read as clutter.
- **The scroll container carries `tabIndex={0}` and an `aria-label`.** A plain
  overflow container cannot be scrolled by keyboard, and unlabelled it is an
  anonymous box of list items to a screen reader.
- It uses the `margin-inline: calc(-1 * var(--card-pad))` + `padding-inline`
  trick (shared with `.eval-form-card__scroll`) so the scrollbar rides the card
  border rather than floating inside the padding.
- `.feed-row--soon` (interview inside 24h) tints the date tile **and** the meta
  line stays bold red — never colour-alone.

### States

`EmptyState` covers empty **and** error (`variant="error"`, which gets the
danger border and `role="alert"` — a failure rendered in the neutral empty
style reads as "there is genuinely nothing here", which is a different and
wrong message). Add `page` for a state that owns the whole screen.

For loading, **hold the shape of what is coming**: `SkeletonRows` for a
list/table, `SkeletonCards` for a tile grid, `Skeleton` for one block. The
spinner (`LoadingPanel`) is only for cases with no shape to preview — a route
resolving, or an action in flight.

### Mobile first — the house rule

Base rules describe the **phone**; `min-width` media queries enhance upward.
No `max-width` queries, and the phone is never the exception. Concretely:

- Base padding/gap is the tight one (12px), loosening at `≥576` and `≥768`.
- Touch targets are ≥44px in the base; the `≥768` block tightens them to the
  compact pointer scale (see `.nav-item-link`, `.app-sidebar__icon-btn`).
- **List tables use `.table-cards`**, which reflows each row into a labelled
  card in its base rules and restores table layout at `≥768`. Add
  `data-label="…"` to every `<td>`, `class="col-actions"` to the actions cell,
  and wrap that cell's buttons in `<span class="row-actions">`.
  **Do not reintroduce `d-none d-md-table-cell`** — it silently drops columns on
  small screens, which is what this replaced.
  **Never set a `height` on a `.table-cards` `<tr>`.** In card mode the row is
  `display: block`, so a height stops being a table-row minimum and becomes a
  hard box — which clips every labelled cell after the first inside
  `.table-wrap`'s overflow, hiding most of the record on a phone. Row height
  comes from the cells' padding.
- Modals are full-height sheets with a pinned footer in the base; Bootstrap's
  centred dialog returns at `≥576`.
- Verify at **360 / 430 / 768 / 1280** in both themes, checking for horizontal
  overflow.

### Accessibility notes worth keeping

- Status is never colour-alone: `.badge-pill` variants carry a leading glyph.
- **Focus** is one rule for everything focusable: a solid `--primary` outline on
  `:focus-visible` with a `--focus-ring` halo behind it. The previous 3px
  22%-alpha glow read as a soft halo rather than an outline and, being mostly
  transparent, took the contrast of whatever it sat on — which fails WCAG 2.2's
  3:1 focus-appearance requirement over the muted surfaces.
- `AppShell` renders a **skip link** to `#main-content` (the `<main>` wrapping
  the outlet), so a keyboard user isn't tabbed through the whole sidebar on
  every page.
- Skeletons are `aria-hidden` inside an `aria-busy` `role="status"` region, so a
  screen reader hears "busy" once rather than a wall of empty boxes.
- A fill that sits under white text uses `--primary-dark`, **not** `--primary`.
  `--primary` brightens in dark mode so it stays legible *as text*, which leaves
  white on top of it at ~2.2:1. The same reasoning drives `--kpi-ink` and
  `--eval-ink`, which flip the glyph to dark ink on bright dark-mode accents.
- Every token pairing was checked against WCAG AA; the tightest is `--muted` on
  `--surface-muted` (table headers) at 4.73:1. Re-check if you change them.

## Routing & layout (`App.tsx` + `components/shell/`)
- `/login` → `LoginPage` (public, outside the shell).
- All other routes are children of `ProtectedLayout`, which is now **only the
  auth gate**: spinner while `loading`, redirect to `/login` (preserving `from`)
  when unauthenticated, redirect to `/change-password` when `mustChangePassword`,
  otherwise render `<AppShell />`.
- **`AppShell`** is the chrome: a collapsible **left sidebar** beside a scrolling
  main column whose header is a sticky topbar and whose body is
  `.rg-content > <Outlet />`.
  - *Sidebar* (`SidebarNav`) — 248px, collapsing to a 64px icon rail (persisted
    to `localStorage['rg-sidebar']`); an off-canvas drawer with a scrim below
    768px. Two zones: brand + collapse control, then the nav list from
    `navRoutes.ts`. **Nothing else.** The footer that held the theme toggle and
    the user card was removed — it carried no navigation, yet on the collapsed
    rail it was one of the first things the eye landed on.
  - *Topbar* (`TopbarTitle`) — the current route's icon, title and one-line
    description, prefix-matched so `/candidates/7` resolves to Candidates. The
    actions cluster holds **`ThemeMenu`**, `NotificationBell` and **`UserMenu`**
    (initials avatar + presence dot → name/email, role pills, Change password,
    Sign out). All three share `.topbar-btn` sizing and the `.menu-panel` /
    `.menu-item` dropdown shape, so they read as one set.
  - **Dropdowns must be controlled.** react-bootstrap only auto-closes on
    `<Dropdown.Item>`; the panels here use plain buttons and links, so each
    holds `show`/`onToggle` state and closes itself on selection. Forgetting
    this leaves the menu hanging open after a choice.
- **The topbar owns the page title**, so pages must not render their own `<h2>`
  heading. A heading that is *content* (a candidate's name) is fine, as is a
  `PageHeader` carrying a real title/description (the evaluation report).
- **A page's primary action shares the filter row — `.page-bar`.** Because the
  topbar owns the title, a page that only wants an action button used to render
  a `PageHeader` with no text: an empty 38px row plus a 24px stack gap, **62px
  of vertical space for one button**, directly above a filter bar with room to
  spare. `.page-bar` puts the two on one line — `<div class="page-bar">` with
  the `<search><div class="data-toolbar">` first and a `.page-bar__actions`
  after it. Measured, `/candidates` and `/configuration` went from 86px of dead
  space above their content to 24px.

  Mobile first: `.page-bar` is a column that becomes a row at `≥768`, so the
  action drops below the filters and goes full width on a phone.

  Keep the `data-toolbar` field max-widths **modest**. A flex line breaks on
  its items' *hypothetical* sizes (their flex-basis), not on how far they could
  shrink, so generous caps made the row wrap and strand "Referred only" alone
  on a second line once the action shared the row.

  `/users` keeps a plain `PageHeader` — it has no filter bar for the action to
  pair with, and a lone button above a table is a normal layout.

  **Actions do not belong in the topbar.** That was tried and reverted: putting
  them in the chrome makes a page-level action read as app-level and separates
  it from the content it acts on.
- **The page gutter is `--space-page` on all four sides, and the page is not
  capped or centred.** It used to be capped at `--content-max` (1536px) and
  centred, which meant that past that width the centring added margin *on top
  of* the padding: at 1920 the side gutters measured 92px against a 24px top,
  so the page read as inset left and right but not above. The topbar takes the
  same `--space-page`, so its title sits directly over the page's left edge.
  Prose is capped where prose actually is (`.page-header p`,
  `.section-description`, `.narrow-column`, `.detail-edit-column`) — a
  page-wide cap also squeezed tables and dashboards that had every reason to
  use the width.
- Adding a route means adding it to `navRoutes.ts` (label, lucide icon,
  description, `roles`) **and** to the `RequireRole` guard in `App.tsx`. The two
  are deliberately separate: `navRoutes` decides what is *shown*, `RequireRole`
  decides what is *reachable*, and a missing guard must never be covered for by
  a hidden nav item. `navRoutes.test.ts` covers the visibility side.
- **Candidate role/skill lookups** come from `getActiveRoleOptions`/`getActiveSkillOptions` (`/api/candidates/role-options` · `/skill-options`, `CanWriteCandidate`); `role-options` is server-scoped so a Recruiter only sees their assigned roles. `CandidateForm` **auto-selects** the role when the list has exactly one (a single-assigned recruiter). The **"Delete candidate"** button on `CandidateDetailPage` shows only for `isAdminOrAbove` (delete is Admin-only). The dashboard shows recruiter-only users a **role filter** (`Form.Select` of their assigned roles + "All") that feeds `getDashboard(roleId)` and the `['dashboard','scoped',roleId]` key.
- Routes: `/` → `DashboardPage` (landing), `/candidates` + `/candidates/:id` (Recruiter+, `RequireRole`), `/upload` (Recruiter+), `/interviews/:id` → `InterviewPage` (all roles), `/configuration` (Admin+), `/users` (SuperAdmin), `/change-password`. The **Dashboard** nav link (`to="/" end`) is first and visible to all roles; the **Candidates/Upload** links show only for `canWriteCandidates`. So an **Interviewer** (bottom of the hierarchy — `useAuth().isInterviewerOnly`) sees Dashboard only, plus the interview pages they're linked to. The **topbar** hosts a **`NotificationBell`** (all roles). Nav visibility is driven by `navRoutes.ts`, not by inline conditionals.

## Data fetching (TanStack Query)
- Reads: `useQuery` with array keys — `['dashboard']`, `['candidates', { search, status, page }]`, `['candidate', id]`, `['status-options']`, `['status-options', 'initial']`, `['status-options', 'next', id]`, `['notifications']` (60s `refetchInterval`), `['my-interviews']`, `['assignable-users']`, `['interview', id]`. Use `keepPreviousData` for paged lists.
- Writes: `useMutation`; on success invalidate keys — e.g. after create/delete/status change, `invalidateQueries({ queryKey: ['candidates'] })` and/or `['candidate', id]`.
- All calls go through `services/api.ts` functions; never call Axios in a component.

## `services/api.ts`
- Axios instance: `baseURL = '/api'` (same-origin → Vite proxies to backend), `withCredentials: true`.
- **Auth interceptors**: attach in-memory access token on requests; on 401, do a single silent `/auth/refresh` and replay the request, else redirect to `/login`. See [auth.md](auth.md).
- One exported, typed function per endpoint: `getDashboard`, `uploadCV`, `getCandidates`, `getCandidate`, `getStatusOptions`, `getInitialStatusOptions`, `getNextStatusOptions`, `createCandidate`, `updateCandidate`, `addStatus`, `deleteCandidate`, `downloadCvFile`, `previewCvFile`, `getRoleOptions`/`createRoleOption`/`updateRoleOption`/`deleteRoleOption`, `getSkillOptions`/`createSkillOption`/`updateSkillOption`/`deleteSkillOption`, `getAssignableUsers`, `getMyInterviews`, `getInterview`, `saveEvaluation`, `getNotifications`/`markNotificationRead`/`markAllNotificationsRead`, `login`, `logout`, `refreshSession`. (`getCandidateRoles` from the prior free-text role feature remains but is unused by the forms.)
- **Authenticated file download**: `downloadCvFile` fetches the CV as a blob (so the bearer token is sent) and triggers a browser save — a plain `<a href>` can't carry the token.

## Key flows
- **Upload** (`UploadPage` + `BulkUploader` + `CandidateForm`): drop multiple PDFs/`.docx` → each posts to `/cvupload` → drafts queue → review/edit in `CandidateForm` with database-backed initial-status dropdown → `createCandidate`. Reject/Discontinued require an initial-status comment. Handles the duplicate-email 409 ("save anyway / open existing").
- **List** (`CandidatesPage`): paged table with **URL-synced filters** (`useSearchParams` — bookmarkable, survive refresh; a **Clear filters** link resets them): search by name/email/**phone**, database-backed status filter, **role filter** (job opening — `GET /candidates/role-filter-options`, includes inactive roles labelled "(inactive)"; scoped: Admin+ see all roles, a Recruiter sees their assigned roles), **skills multi-select** (ANY-of, active skills via `getActiveSkillOptions`), and a **Referred only** toggle. **Sortable headers** (Name/Status/Added → `sort`+`dir` params, default Added desc; click flips direction with a ▲/▼ indicator). Per-row delete (confirm modal, Admin+ only). Responsive: columns hide progressively on small screens (email shown under the name on mobile).
- **Detail** (`CandidateDetailPage`): **read-only by default** — a `.page-header` (avatar, name, role, `StatusBadge`) with **Edit** / **Evaluation report** / **Delete** actions. **Read mode** is `.detail-grid.detail-grid--panels` (5/7 at `≥992`, stacked below). `--panels` makes the two columns **share one bounded height** so their bottoms line up, with each column's dominant card (`.detail-scroll` — the profile, and the status history) scrolling its own **body** while its header stays pinned; otherwise a long timeline stretched the page and left the profile beside a column of whitespace. The cap is `min(max(--detail-panel-min, viewport - chrome), viewport - topbar - 1rem)`: at least **`--detail-panel-min` (760px)** so a short window can't squeeze the panels down to something unreadable (derived from the viewport alone, a 720px-tall laptop produced 480px), but **never taller than the viewport**, since a panel taller than the screen means scrolling the page *and* the panel. `--detail-panel-min` is the comfort dial. It is a *cap*, not a height, so two short columns still size to their content. The plain `.detail-grid` (no `--panels`) is what `InterviewPage` uses, where the evaluation form must grow freely. Contents: `ReadOnlyCandidateProfile` + `CvFilesCard` on the left, and **"Status history"** on the right. Advancing the pipeline is an **`AddStatusModal`** opened from an "Add status" button in that card's header (writers only), not a form sitting permanently open: the form is used occasionally, it grows to five fields when "Interview Scheduled" is picked, and leaving it open pushed the history — the thing you came to read — down the page on every visit. The Modal lives *inside* `AddStatusModal` rather than in the caller so the `<Form>` can wrap both `Modal.Body` and `Modal.Footer`, which is what puts Submit in the pinned footer (a sheet footer within thumb reach on a phone) while still submitting the form. Dismissing resets the draft. `ReadOnlyCandidateProfile` is passed **`showCvFiles={false}`** here: it has its own CV list, and rendering it alongside `CvFilesCard` listed every file **twice**, in two designs, each with its own Preview and Download. The interview page, which has no second card, keeps the list (the prop defaults to `true`). **Edit** (shown only when `canWriteCandidates && !roleClosed`) switches to a **focused single-column form** (`.detail-edit-column`, capped at 860px) with `ProfileEditor` + `CvFilesCard`, and **hides the Status panel**; Save or Cancel returns to the read view with refreshed data. Delete is a confirm modal (Admin+); the Evaluation report link goes to `/candidates/:id/evaluations`.
- **Evaluation report** (`CandidateEvaluationReportPage`, route `/candidates/:id/evaluations`, Recruiter+): fetches `getCandidateEvaluationReport(id)` and shows a summary panel (interviewer count, average overall, recommendation tally, per-criterion averages ordered by `EVALUATION_SECTIONS`) then every interviewer's full rubric grouped by interview, reusing `EvaluationReadOnly`. Has a **Print** button (`window.print()`, `d-print-none` chrome) and an empty state when no evaluations are submitted yet.

Both the upload `CandidateForm` and the detail `ProfileEditor` include **GitHub URL**, **Portfolio website**, a **Role applied for** single-select and a **Skills** multi-select (both `components/SearchableSelect.tsx`, fed by `['config','roles']` / `['config','skills']` — configured values only, **not creatable** from the candidate form), and a **"This candidate has been referred"** checkbox revealing Reference name\* / email\* / Employee ID. Forms validate required full name + email format client-side (mirrored server-side); the legacy free-text role datalist was replaced by the configured role select.

### Dashboard (`pages/DashboardPage.tsx`, route `/`)
**One `useQuery` per section** (no single payload), rendered as react-bootstrap `Row`/`Col`/`Card`:
the org-wide queries `['dashboard','kpis']`, `['dashboard','status-breakdown']`,
`['dashboard','trend',days]`, `['dashboard','job-openings']` render **for every role**; the
owner-scoped `['dashboard','scoped']` (`enabled: canWriteCandidates`) feeds the candidate-centric
sections and renders only for candidate-managing roles. An **Interviewer** therefore sees the same
KPIs / charts / openings as an Admin, plus their My-Interviews card, but not By-role/Top-skills/
Upcoming/Activity.
- **Hero kicker** — `components/dashboard/DashboardHero`: greeting + user name + date and
  **pending-task chips** from `['my-interviews']` / `['notifications']`. Styled
  `.dashboard-hero-kicker` + `.hero-chip` (`anim-fade-up`, dark + reduced-motion).
  The chips are strictly *the signed-in user's own outstanding work*. A chip counting
  candidates in process was **removed**: it is a pipeline statistic rather than a task, it
  already exists as the "In process" KPI card directly below, and it made the row read as a
  mix of "things you must do" and "things that are true". `DashboardHero` therefore takes no
  props — don't reintroduce `inProcessCount`.
- **KPI cards** — six `components/dashboard/KpiCard`s (accent icon chip, big value, sub-label + %,
  thin progress bar; `.kpi--<tone>` tokens, light + dark, reduced-motion). Icons inline in
  `kpiIcons.tsx`.
  **All six drill through** to the candidate list showing exactly what they count, rendering as a
  `<Link>` with a persistent arrow in the action corner. Total → `/candidates`, Referred →
  `?referred=1`, the other four → `?bucket=in-process|recommended|rejected|new-this-week`, which the
  API resolves through `CandidateBuckets` — the same definitions the dashboard sums, so a tile and
  its list cannot disagree. (`status` alone could not express them: *Rejected* spans four statuses,
  *In process* is "not yet terminal", *New this week* is a date window.)
  **Only pass `to` when the destination reproduces the tile's figure exactly** — a stat that opens a
  list with a different total is worse than one that does not open. Interviewers get no links,
  since they can see the figures but not the list.
  The arrow is **persistent, not hover-only**: a cue that appears only under the pointer cannot tell
  you the tile is a link before you find it. It sits beside the icon rather than inline with the
  label (where a longer label wrapped it onto its own line) or in the foot (where it truncated the
  sub-label).
  `CandidatesPage` surfaces an arriving bucket as a removable `.filter-chip` — it is an active
  filter that none of the visible controls represent, so without it the short list looks like a bug.
- **Charts** (recharts) — `StatusDonutChart` (colored from the status tokens via
  `utils/chartColors.ts` so it matches `StatusBadge`) beside `TrendChart` (area) with a **7D/30D/90D
  range toggle** (`btn-group` → `trendDays` state → query key + `getApplicationsTrend(days)`), and
  two `CountBarChart`s (by role, top skills). (The redundant pipeline funnel was removed — the donut
  is the single status visual.) Charts read `useTheme()` so colors flip with the theme.
- **Lists** — upcoming interviews and recent activity (names link to
  `/candidates/:id`, `StatusBadge` pills). **Recent activity** is a `.feed-list`
  (see *Feed lists*): the candidate's initials `.avatar` leads the row, name +
  status share the headline, "by X" is the meta line and the relative time is a
  `<time>` in the aside; capped at three rows and scrolling. **Upcoming
  interviews still uses the flush `ListGroup`/`.list-row`** — its rows carry a
  scheduled date, so it maps onto `.feed-date` the same way `MyInterviewsCard`
  does whenever it is brought across.
- **Active Job Openings** — `ActiveJobOpeningsTable`: Job ID (`JOB-00n`), posted date, title +
  priority badge, location, department, **End date** (+ a `.job-closing-soon` badge when within 7
  days), applicants; "View All" → `/configuration`. Backend returns **open** roles only (past their
  End date drop off).

Charts are added under **`recharts`** (the only chart dependency). New chart chrome/colors go through `chartColors.ts`, not hardcoded hex.

### Interviews, evaluations & notifications
- **Scheduling:** in `CandidateDetailPage`'s `AddStatusModal`, choosing **Interview Scheduled** reveals a required **Interviewers** `SearchableMultiSelect` (options from `['assignable-users']`); the payload adds `interviewerUserIds`, and success invalidates `['notifications']` + `['my-interviews']`.
- **Notification bell (`components/NotificationBell.tsx`, topbar):** `['notifications']` query with a 60s `refetchInterval`; unread badge; dropdown of the latest ~15; clicking marks read (mutation) and navigates to the item's `linkUrl`; "Mark all read".
- **Dashboard "My interviews" (`components/dashboard/MyInterviewsCard.tsx`):** `['my-interviews']` list of the caller's assigned interviews with date/time (highlight <24h) and an evaluation-state badge (Pending/Draft/Submitted); rows link to `/interviews/:id`. Rendered as a **`.feed-list`** (see *Feed lists* under Design system): a `.feed-date` tile leads each row, the time and zone sit in the meta line, and the list is capped at three rows and scrolls.
- **Interview page (`pages/InterviewPage.tsx`, `/interviews/:id`):** a **hero header card** (candidate **initials avatar + name + Role Applied For + interview type tags**, calendar chip with a relative badge Today/Tomorrow/In N days/Completed, interviewer avatar pills) above two columns with a staggered `.anim-fade-up` entry — left `ReadOnlyCandidateProfile` (non-editable card; **header** = "Current position" (renamed from the ungrammatical "Position on Last Organization") + LinkedIn/GitHub/Portfolio icon links + status pill, no name/avatar; **body** = email/phone/**Relevant Experience** detail tiles, colorful skill badges via `utils/skillColors.ts`, an **extendable Summary** (Show more/less), and CV files as `.cv-file-item` tiles with Preview (`outline-primary`) + `.btn-cv-download` reusing `previewCvFile`/`downloadCvFile`); right `EvaluationForm` driven by `utils/evaluationCriteria.ts`. **`.btn-cv-download` is no longer the hardcoded yellow fill with the looping icon bounce** — the colour was a literal rather than a token, yellow is the app's *warning* hue so the safest action on the panel wore the colour meaning "careful", and it made Download louder than Preview, which is the action a reviewer wants first. It is now the same secondary control as its Preview sibling. The hero drops the redundant "Interview" eyebrow (the topbar says it), puts the role and type tags on one meta line, and folds the schedule chip + interviewers into one right-hand `.interview-hero__aside` — they were two rows with a divider between, spending a third of the hero on what is usually one avatar pill (116px tall now, was ~230px). The grid is **`.detail-grid.detail-grid--panels.interview-grid`**: `--panels` supplies the equal-height / internal-scroll mechanics (shared with the candidate detail page), and `.interview-grid` overrides `--detail-panel-max` to exactly the viewport below the topbar and pins **both** columns `position: sticky`. The 760px floor is deliberately dropped here — a column taller than the space under the topbar hangs past the fold, which is what capping only the evaluation card left behind. The result is a fixed two-panel workspace: the candidate profile (`className="detail-scroll"`) scrolls on the left, the rubric on the right, and the two cards are the same height with their bottoms aligned. Inside it only the rubric scrolls (`.eval-form-card__scroll`) — the progress bar and the Submit / Save draft actions stay put, where before the card ran ~2500px and Submit was a screen below the last criterion. **Note the class is `eval-form-card`, not `eval-card`: `.eval-card` is already the per-interviewer summary tile in the status timeline, and reusing it silently inherited its `align-items:center` and padding.** Desktop only — a bounded scroll area nested in a scrolling page is worse than a long page on a phone. The recruiter's notes are folded **into** the evaluation card as an `.eval-briefing` band above the progress bar (passed to `EvaluationForm` as a `briefing` node, so the form need not know what the briefing is). They are instructions *for that form*, so they belong to the same object; as their own card they cost a whole surface plus a gap to show one line, and as an `alert-info-soft` before that they were the loudest thing on a page whose subject is the candidate. Being outside the scroll region they stay readable the whole way down the twelve criteria. The evaluation column is therefore exactly one card. The interviewer pills keep an inline "Interviewer(s)" label — the pills are meaningless without it, but it does not warrant a band of its own. the recruiter's notes render as a quiet **`.notes-card`**, not an `alert-info-soft` — as a tinted alert a one-line note was the loudest thing on a page whose subject is the candidate. In the rubric, each criterion's label column is capped (`--eval-label-w`) so the 1–5 scale sits a short, **constant** distance from every label: the row was `justify-content: space-between`, which parked the pills ~400px away against the panel's right edge and made rating twelve criteria twelve trips across the card. The comment field spans label + scale, and the panel header wraps so the "n/3 rated" chip drops below the title on a phone rather than squeezing it. Sections A–D are **independent collapsible accent panels** (`.eval-panel--a|b|c|d`, react-bootstrap `Collapse`, per-section icon + live `n/3 rated · avg` summary, rotating chevron); ratings use a **segmented 1–5 pill group** (click again to clear, `aria-pressed`); a top progress bar tracks `Rated X of 12`; general assessment / recommendation / overall rating live in a static "Summary & recommendation" panel. Recommendation options are `Recommended/Hold/Reject/Other`; picking **Other** reveals a required "Please specify" text box (blocks Submit until filled). **Save draft** any time (never gated); **Submit is gated** — all 12 criterion ratings, a final recommendation, and an overall rating are required (red `*` indicators; a failed attempt sets `showErrors`, flags the empty groups via `.rating-group--invalid`, and toasts what's missing before the confirm modal opens). **Submit** confirms via modal then locks (server returns 409 after). Read-only/submitted views reuse the panels with **filled-dot rating scales**. Admin+ also see other interviewers' evaluations read-only in an accordion. A 404 (not assigned / not admin) renders a friendly "not available" message. All animations respect `prefers-reduced-motion`.
- **Status timeline interviewer links (`components/StatusTimeline.tsx`):** the "Interview Scheduled" entry shows its interviewers as **`.interviewer-pill` avatar pills** (initials + name), each a `<Link>` to `/interviews/{interviewId}`, plus the interview's **type tags** as `skillColorClass`-colored badges (from the entry's `interviewTags`). The **schedule form** (`CandidateDetailPage`'s `AddStatusModal`) adds an optional **Interview types** `SearchableMultiSelect` (from `getActiveInterviewTypes`) above the interviewers select. Timeline **dots** carry a soft `--status-tint` ring so they read distinctly from the tinted status badge. Comments render with `white-space: pre-line` (so the appended evaluation summary's line breaks show). An **"Interview Completed"** entry renders its `evaluationSummaries` as **cards** (initials avatar, interviewer name, overall-rating dots, a recommendation `status-badge` colored by outcome — Recommended/Hold/Reject/Other → success/intake/reject/muted, submitted date); Admin+ additionally get a **"View full evaluations →"** link to `/interviews/{id}` (gated by the `canViewEvaluations` prop = `isAdminOrAbove`). `cleanComment` strips any legacy baked-in "— Interview evaluations —" text so only the human comment shows above the cards.
- **Interview page notes:** scheduling with "Notes for interviewers" text (the relabeled optional comment on the Interview Scheduled add-status form) stores it as the scheduled entry's comment; `InterviewPage` shows it as a **"Notes from the recruiter"** info card above the candidate profile (`InterviewDetail.notes`). Re-scheduling from Interview Completed reuses the same add-status flow (the new `8 → 3` transition surfaces Interview Scheduled as a next option).
- **Peer evaluations:** `InterviewPage` renders an **"Other interviewers' evaluations"** accordion when `InterviewDetail.allEvaluations` is present (filtering the caller out). The backend only populates that list for Admin+, or for an assigned interviewer **after they submit & lock their own** (peers' submitted evaluations only) — so a peer can't preview colleagues before forming their own view.

### Audit trail page (`pages/AuditLogPage.tsx`, route `/audit`, Admin+)
A filterable, paginated view of `GET /api/audit` (`['audit', filters, page]`, `keepPreviousData`): a filter bar (entity-type select, action text-contains, from/to `datetime-local`) applies on submit; a table lists Time · Actor · Action (colored `Badge`) · Entity · Summary, with prev/next paging (50/page). Route + nav gated to `SuperAdmin`/`Admin` (`RequireRole` + `isAdminOrAbove`).

### Configuration data notes (`pages/configuration/`)
The page's structure is described under [Configuration page](#configuration-page-pagesconfigurationpagetsx--pagesconfiguration) further down; this covers the data contracts.

Query keys are `['config','roles','all']` / `['config','skills','all']` /
`['config','interview-types','all']`, all fetched with `includeInactive=true`;
mutations invalidate the `['config']` prefix so candidate forms refresh too.

- **Job openings** (`JobOpeningsTab`) — **Role name**, a required **Closes**
  (`datetime-local`), **Location**/**Department** as dropdowns (fixed sets
  mirroring `JobOpeningOptions.cs`), **Priority**, and optional **Recruiters**:
  a `SearchableMultiSelect` over active users (`getAssignableUsers`) whose
  option label is `"Name (email)"` so it matches on either. Each assigned
  recruiter can access every candidate under that role. **Delete is Super Admin
  only** and confirms first; the result toast reports whether the role was
  deleted or (having candidates) deactivated.
- **Interview types** work exactly like Skills — used as multi-select tags on
  the interview schedule form and shown as coloured badges.
- **Email / SMTP** (`EmailSettingsTab`, `isSuperAdmin` only) — host, port,
  username, password (`type=password`, write-only; placeholder "leave blank to
  keep" when `passwordSet`), from-address/name, STARTTLS + Enabled toggles, plus
  a **Send test email** button defaulting to the current user's email. Backed by
  `getEmailSettings`/`saveEmailSettings`/`sendTestEmail` (`/config/email*`); the
  password is never returned by the API.

### Status colors (`utils/statusColors.ts` + `components/StatusBadge.tsx`)
`getStatusClass(status)` maps a status to a **tone** modifier class (`status--reject|success|interview|assessment|muted|uploaded|intake`). The colors are CSS design tokens in `index.css` (`--status-color` solid for the dot, `--status-tint` translucent for the badge background), with a `[data-bs-theme="dark"]` override block so a future dark theme just flips `data-bs-theme` on `<html>` — no component changes. Use the shared `StatusBadge` / `StatusDot` components (do not reintroduce per-call Bootstrap `bg-*` variants); applied to the candidate list, detail header, and `StatusTimeline`.

### CV preview (`CvFilesCard` in `CandidateDetailPage`)
Each CV file has **Preview** + **Download**. Preview calls `previewCvFile` (authenticated blob → object URL) and renders PDFs in an `<iframe>` (`.cv-preview-frame`); non-PDF types show a friendly fallback and keep Download. Object URLs are revoked on change/unmount.

### Login
`LoginPage` no longer hints credentials (placeholders removed, `autoComplete="off"`, no app-prefill).

## Theme (`styles/tokens.css`)
- **Coastal teal `#468189`** on near-neutral surfaces, Figtree, 14px base. Token
  names and scales follow Prism; the palette descends from GorillaHR, which is
  where Prism's does too.
- Semantic **status / priority / skill / KPI / evaluation** colours are
  deliberately *not* derived from the brand hue and live in `index.css`.
  `utils/chartColors.ts` resolves `--status-color` off a hidden probe element
  rather than duplicating hexes, and reads chart chrome off the tokens.
- **Don't hardcode colours.** Avoid fixed light utilities like
  `bg-light`/`bg-white`/`text-dark` — use tokens or `bg-body-tertiary` so they
  adapt to dark mode.

### Dark mode / theming
- **Token flip:** light is `:root`; a `[data-bs-theme='dark']` block in
  `tokens.css` overrides the neutrals and accents. Because the `--bs-*`
  variables map onto the tokens, the whole app flips automatically. Bootstrap
  5.3 / react-bootstrap also honour `data-bs-theme`.
- **State:** `theme/ThemeContext.tsx` (`ThemeProvider` + `useTheme`) exposes
  **`preference`** (`'light' | 'dark' | 'system'` — what the user chose) and
  **`theme`** (`'light' | 'dark'` — what is painted). Components that need the
  actual appearance (the charts) read `theme`; only the picker reads
  `preference`. Sets `data-bs-theme` on `<html>`; wrapped around `<App/>` in
  `main.tsx`.
- **`localStorage['rg-theme']` stores the *preference*, not the resolved
  theme.** It used to store the resolved one, which made "follow the OS"
  unrepresentable — once anything was saved the app was pinned to it forever.
  Old `'light'`/`'dark'` values are still valid preferences, so nothing needed
  migrating.
- While `preference === 'system'` the provider keeps a `matchMedia` listener
  attached, so an OS change **after** load is picked up live.
- **No-flash init:** an inline script in `index.html` sets the attribute before
  paint. It must resolve `'system'` (and "nothing saved") against
  `prefers-color-scheme` — writing the stored value straight through would set
  `data-bs-theme="system"`, which matches no stylesheet and paints light.
- **The logo is `components/BrandLogo.tsx`**: the gorilla-in-a-magnifier badge over an
  uppercase two-weight wordmark —
  RECRUITMENT tracked at 0.1em over GORILLA smaller and tracked at 0.42em.
  Three layouts from one source: `stacked` (sign-in card), `horizontal` (the sidebar's 32px
  row), `mark` (collapsed rail).
  The **mark is a raster asset and the wordmark is HTML text** — keeping the wordmark out of the
  image means one file rather than one per layout, and it stays typeset by the app's own type
  tokens. The artwork is **imported** (`src/assets/brand-logo.png`), not referenced from
  `/public`: an import is fingerprinted and rewritten under the gateway's `/ats/` base, where a
  hardcoded `/brand-logo.png` would 404 in the container build.
  Its background was **flood-filled to transparency from the image borders** when the asset was
  generated, so no theme-specific plate sits behind it. Filling every white pixel instead would
  have punched out the white disc inside the ring and the white lettering — those are enclosed,
  so a fill that starts at the edges never reaches them. `.brand__mark` is a square box and the
  portrait lockup is fitted into it with `object-fit: contain`, so `--brand-size` still means
  the same thing it did for the square SVG that preceded it.
  `public/favicon.png` is the same artwork padded to a square; `index.html` links it as
  `type="image/png"`. Both are palette PNGs (~10KB and ~6KB) — the badge is flat-coloured, so
  quantising costs nothing visible and saves ~190KB over a straight resize.
  **Note:** at the sidebar's 30px the "Hiring" pill in the badge is not legible; the gorilla
  head still reads. A badge-only crop for the small layouts is the open option there.
- **Picker:** `components/ThemeMenu.tsx` — a Light / Dark / System dropdown in
  the topbar and on the login card. The trigger icon shows what is currently
  *painted*; the tick marks the *preference*, so it sits on "System" even when
  that resolves to dark.
- **The dark neutrals are deliberately low-saturation** (8–14% on the coastal
  hue) and text sits at 88% lightness, not 94%. A saturated dark ground reads as
  loud however dim it is, and ~15:1 text is past AA and into glare. Don't
  "enrich" them back.
- When adding UI, check both modes and re-read the accessibility notes above
  before putting white text on a coloured fill.

### Configuration page (`pages/ConfigurationPage.tsx` + `pages/configuration/`)
Four tabs rather than four stacked cards, with the active tab in the query
string (`?tab=skills`) via `useTabs`. Email is Super Admin only and its tab is
absent, not disabled, for everyone else.
- **Job openings** — full-width rows (`.job-row`), not a table: identity on the
  left, then status + a days-left figure, then the closing date with a progress
  bar through the posting window, then delete and a chevron. The row itself is
  the edit affordance; the delete button stops propagation. Stacked in the base,
  becoming a row at `≥992` (five columns of content need the width, so a tablet
  gets the stacked version).
  `utils/jobStatus.ts` supplies all three derived values: `jobStatus()` collapses
  `isActive` and `endDate` into one lifecycle value (inactive → closed →
  closing-soon → open — rendering those two as independent facts is what
  previously let a row show "Active" and "Closed" at once, so keep them
  collapsed), plus `daysUntil()` and `elapsedPercent()`. `elapsedPercent`
  returns `null` when it can't be computed and the bar is then **omitted** —
  an unknown must not render as a real answer of 0%.
- **Skills / Interview types** — one `OptionChipsTab` used twice; coloured pills
  with an inline remove and an add field in the flow of the chips. The chip's
  **× now opens a `ConfirmModal`** rather than firing the delete immediately:
  removing a skill can deactivate it across every candidate tagged with it, the
  chips sit a few pixels apart, and there is no undo.
- **Email** — grouped into Server / Credentials / Sender fieldsets.
- **`sortOrder` is not in the UI.** It is still sent — auto-assigned `last + 1`
  on create, preserved on edit. Don't surface it again; if reordering is needed
  it should be drag-and-drop.

## Build / typecheck
```bash
cd client
npm run dev          # dev server (proxy + LAN host)
npx tsc -b           # typecheck (run after edits)
npm run build        # tsc -b && vite build
```
The `.docx`/PDF flows and auth need the backend running; see [dev-setup.md](dev-setup.md).
