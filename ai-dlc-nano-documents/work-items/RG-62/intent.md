# Bulk selection action bar overlaps editor-studio footer (responsive)

- Source: issue #62 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/62
- Type: Bug (labels: bug, UI)

## Request
- At narrow/short responsive viewports (reported at 830x835), the floating bulk
  selection bar in Upload CVs -> Review Staging Workspace covers "Discard Draft",
  "Save Changes" and "Approve & Create Candidate" in the candidate detail footer.

## Repro (confirmed, via Playwright at 830x835)
- `.draft-editor-studio` uses `height: calc(100vh - 220px)` under the `max-width:
  991px` media query (`client/src/index.css:7937-7941`). At this viewport the real
  chrome above the panel is ~298px, not 220px, so the panel's computed height
  (615px) pushes its footer ~88px below the fold at default scroll position.
- The existing bulk-bar-inset mechanism (`DraftReviewWorkspace.tsx:62-100`,
  `index.css:8142-8147`, from commit 7816d727) correctly reserves space for the
  fixed bar *within* the panel, but it cannot compensate for the panel itself
  already extending past the viewport - the footer still lands directly behind/
  under the fixed bar at the page's default scroll position.
- Confirmed the reservation math itself is correct: scrolled fully to the bottom
  of the page, the footer clears the bar with a visible gap. The bug is that nothing
  prompts/forces that scroll, and the default (unscrolled) view shows the overlap.

## Decisions
- Fix approach: dynamic measured height (reuse the bulkBarInset ResizeObserver/
  getBoundingClientRect pattern already in DraftReviewWorkspace.tsx) instead of
  recalibrating the magic number or refactoring shared global layout -> user
  confirmed, over "recalibrate magic number" and "global flex-fill layout".

## Out of scope
- Global app-layout flex refactor (`.app-main`/`.rg-content`) - larger blast
  radius, not needed once the panel measures its own available height.

## Follow-ups
(none yet)
