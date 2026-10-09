# Spec — In-app User Guide

**Status:** Implemented
**Author:** tahmidsparrow
**Date:** 2026-10-09

## 1. Summary
Every signed-in user can open the user guide from inside the app (sidebar and avatar menu), rendered
as a native page, with content cut to the chapters their role can use.

## 2. Motivation
The guide already existed as `docs/user-guide/USER-GUIDE.md`, a hand-rendered HTML copy and a PDF, but
none of it was reachable from the running app. Candidates for the approach were an embedded HTML
document in an iframe (GorillaHR's pattern) or a native page using the app's own design system; the
native page was chosen so the guide looks and themes like the rest of the app rather than a separate
embedded document.

## 3. Scope
**In scope:**
- One Markdown file per chapter, embedded in the API assembly.
- `GET /api/user-guide`, filtered to the caller's edition.
- A native `/user-guide` page: contents rail, Print / Save as PDF, dark mode via the app's existing
  tokens.
- Sidebar entry (visible to every role) and an avatar-menu entry.

**Out of scope / later:**
- Rewriting or restructuring the guide text.
- Pre-built per-role PDF files — the browser's own "Save as PDF" on the print view covers this.
- Search across the guide, and offline caching.

## 4. Data model changes
None. The chapters are static files, not database rows.

## 5. API contract

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/user-guide` | any signed-in role | none | `UserGuideDto { edition, label, chapters: UserGuideChapterDto[] }` | `UserGuideChapterDto { id, title, markdown }`. 401 if anonymous. |

The edition is always derived from the caller's role claims; it is never a request parameter, so a
reader cannot ask for a higher edition than their own.

## 6. Backend design
- `UserGuideService` (singleton, `Services/UserGuideService.cs`) holds a static manifest of
  `(Id, File, MinRank)` per chapter and ranks the four editions `interviewer < recruiter < admin <
  superadmin`. `EditionFor(roles)` takes the highest role present; no roles (or only an unrecognized
  one) falls back to `interviewer`.
- Each `.md` file lives at `server/Recruitment.Gorilla.API/UserGuide/*.md` and is an
  **embedded resource** (`<EmbeddedResource Include="UserGuide\*.md" LogicalName="UserGuide.%(Filename)%(Extension)" />`
  in the csproj), read via `Assembly.GetManifestResourceStream`, the same pattern
  `CandidateImportService` uses for its JSON template. This is deliberate: there is no file path to
  resolve at runtime, so nothing can go missing from a published or containerized build (the mistake
  GorillaHR's own build had to work around by moving its manual files inside the backend package).
- A chapter's title is its first `# ` heading, read at load time rather than duplicated in the
  manifest.
- Results are cached per edition (`ConcurrentDictionary<string, Lazy<UserGuideDto>>`) since a chapter
  never changes without a redeploy.
- `UserGuideController` (`[Authorize]`, no role restriction) is a single `GET` that calls
  `userGuide.Get(currentUser.Roles)`.

## 7. Frontend design
- Types: `UserGuide`, `UserGuideChapter` in `types/index.ts`. `getUserGuide()` in `api.ts`.
- `utils/slugify.ts`: a GitHub-compatible heading slugger (`slugify`) plus `headingsOf(markdown)`,
  which the guide's own pre-existing cross-reference links (e.g. `[2.2](#22-your-dashboard)`) depend
  on resolving correctly.
- `components/userGuide/GuideMarkdown.tsx`: renders one chapter's Markdown with `react-markdown` +
  `remark-gfm`, mapping every element to the app's existing Tailwind tokens instead of the guide's own
  former embedded CSS. Headings get `id={slugify(text)}`; an in-page link either scrolls to that id
  (if it exists in the reader's edition) or renders as plain text (if the target chapter isn't part of
  their edition); external links open in a new tab; `images/x.png` is rewritten to
  `/user-guide/images/x.png` (served from `client/public/user-guide/images/`, copied verbatim from the
  old `docs/user-guide/images/`).
- `pages/UserGuidePage.tsx` at `/user-guide`: `useQuery(['user-guide'], getUserGuide, { staleTime:
  Infinity })`, a contents rail (desktop: sticky sidebar; mobile: a collapsed accordion) built from
  `headingsOf()` on every chapter, and a Print / Save as PDF button (`window.print()`).
- Print CSS (`index.css`, inside the existing `@media print` block): each chapter (`.guide-article`)
  restarts on its own page; figures, tables and quotes don't split across a page break. The pre-existing
  rule already hides the sidebar/topbar for any page under print.
- Route: a plain protected `<Route path="/user-guide">` in `App.tsx`, no `RequireRole` — matches
  `/change-password`.
- Nav: `navRoutes.ts` gets a `User guide` entry in the Overview group with no `roles` (every role sees
  it). `UserMenu.tsx` gets a matching item next to "Change password".

### Adding or editing a chapter
1. Edit the chapter's `.md` file under `server/Recruitment.Gorilla.API/UserGuide/`, or add a new file
   and a manifest entry (`Id`, file name, `MinRank`) in `UserGuideService.Manifest`.
2. If a screenshot is added, drop it in `client/public/user-guide/images/` and reference it from the
   Markdown as `images/<file>.png` — `GuideMarkdown` rewrites that prefix at render time.
3. The rendered guide's `.md` source is the single source of truth; there is no separate HTML copy to
   keep in sync anymore.

## 8. Security & auth
- `[Authorize]` with no `Roles` restriction: any authenticated user, same shape as
  `NotificationsController`.
- The edition is computed server-side from `ICurrentUser.Roles` and is never accepted as input, so a
  lower-privileged reader cannot request a higher edition's content.
- No raw HTML is rendered from the guide's Markdown (`react-markdown` without `rehype-raw`), so a
  stray `<script>` or `<img onerror=...>` typed into a future edit of the guide cannot execute.

## 9. Acceptance criteria / verification
- [x] An Interviewer's response has no Chapter 2/3/4 text; a Recruiter's adds Chapter 2 only; an
      Admin's adds Chapter 3; a SuperAdmin's has all 7 chapters — `UserGuideServiceTests`.
- [x] `GET /api/user-guide` returns 401 anonymous, 200 with the expected `edition` per role —
      `ControllerAuthorizationTests`.
- [x] A cross-reference link to a chapter outside the reader's edition renders as plain text, not a
      dead link — `GuideMarkdown.test.tsx`.
- [x] No raw HTML (e.g. a `<script>` tag) in the Markdown is ever rendered — `GuideMarkdown.test.tsx`.
- [x] The sidebar and avatar menu both show "User guide" for every role — `navRoutes.test.ts`, manual
      check.
- [x] `dotnet publish` output contains no loose `UserGuide/*.md` files (they are embedded in the DLL) —
      manually verified against a publish output.
- [x] `dotnet test`, `npx tsc -b`, `npm test`, `npm run lint`, `npm run build` all green.
- [x] Manually verified end-to-end against the running app for an Interviewer and a Super Admin:
      edition label, chapter set, in-page jump (`#22-your-dashboard`), dark theme, and print preview.

## 10. Open questions
None outstanding.
