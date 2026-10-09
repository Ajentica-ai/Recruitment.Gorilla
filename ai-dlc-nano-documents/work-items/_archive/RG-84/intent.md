# Make the Sheet (drawer) primitive mobile-first, matching Dialog
- Source: issue #84 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/84
- Type: feature (label `enhancement`)

## Request
- `sheet.tsx` and `dialog.tsx` both wrap `@radix-ui/react-dialog`, but only the dialog
  is mobile-first. `SheetContent side="right"` is a flat `w-[min(28rem,100vw)]` at every
  width: on a 390px phone, a full-screen panel entering horizontally, which reads as a
  page navigation so people reach for the back button and it does not dismiss.
- `SheetFooter` lacks `DialogFooter`'s `env(safe-area-inset-bottom)` padding and
  full-width leading primary action.
- Prerequisite for #85 (converting four dialogs to drawers).

## Decisions
- Blast radius: all three shipped drawers become bottom sheets below `sm`, no opt-out
  prop. One rule, identical to Dialog. Visible phone change to shipped UX, accepted.
- `side="left" | "top" | "bottom"` are dead code: delete them. Sheet becomes a
  right-side drawer that is a bottom sheet on phones.
- Corrects two stale claims: the issue body and `sheet.tsx`'s own doc comment both say
  Sheet powers the mobile navigation. It does not; `SidebarNav` hand-rolls an `<aside>`.

## Out of scope
- #85 itself. No dialog becomes a drawer here.
- The `ui/label.tsx` `htmlFor` backlog entry (different component, a11y not layout).

## Follow-ups
- `e2e/responsive-card-header.spec.ts` (RG-72's guard) is red on clean develop, not from
  this change. It needs seeded data for the `E2E_EMAIL` recruiter: the dashboard renders
  no `[data-slot="card-header"]` against an empty candidate table, and the recruiter
  cannot open `E2E_INTERVIEW_ID` (the chip check passes as Admin). Belongs with #83.
