# Card-view row-actions dropdown overlaps the next candidate card
- Source: issue #65 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/65
- Type: feature (labels: Improvements, UI - no Bug label)

## Request
- On the Candidates page below 1024px, `.table-cards` reflows each table row
  into a stacked card with its action menu (`RowActions`, Radix
  `DropdownMenu`) pinned to the card's bottom-right ("where a thumb can
  reach", per the CSS comment). Opening it renders the "Delete candidate"
  item overlapping the next card below.
- Reproduced live at the exact reported viewport (893x749): confirmed -
  the menu's opaque white box covers part of the next card's name/title.
- Root cause: Radix's `avoidCollisions` only flips placement against
  *viewport* edges, not sibling DOM elements, so there's always room
  "below" in the viewport and it never flips up.
- `RowActions` is shared by three pages using the same `.table-cards`
  pattern (Candidates, Users, Configuration > Email Delivery), so a fix at
  the component/CSS level would apply everywhere, not just Candidates.

## Decisions
- Prefer opening the menu upward (`side="top"`) so it overlaps the
  triggering card's own content instead of the next card, with Radix's
  default `avoidCollisions` flipping it back to "bottom" when there's no
  room above (e.g. the very first row/card near the top of the page) ->
  user confirmed. Scoped to `RowActions.tsx`'s own `DropdownMenuContent`
  call, not the shared `dropdown-menu.tsx` wrapper (which also backs the
  topbar's NotificationBell/UserMenu/ThemeMenu, where "top" would be wrong).

## Out of scope
- `NotificationBell`, `UserMenu`, `ThemeMenu` (unrelated `DropdownMenuContent`
  consumers, topbar-anchored, default "bottom" is correct there).

## Follow-ups
- none yet
