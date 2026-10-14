# Evaluation actions row has no spacing between Save draft and Submit evaluation

- Source: issue #68 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/68
- Type: Improvements / UI (no bug or enhancement label; branch prefix to confirm)

## Request
- The interview evaluation form's two footer buttons sit flush against each other. Issue body is a screenshot only, no text.

## Root cause (confirmed)
- `EvaluationForm.tsx:504-529` uses `eval-form-actions`, `eval-form-actions__hint` and `eval-form-actions__buttons`. **None of the three has any CSS rule.**
- Commit `33ed80a` (customizable rubrics, #24) renamed the row from `form-actions` to `eval-form-actions` and added the hint/buttons sub-structure, but never added the matching CSS. The gap came from `.form-actions` (`index.css:3470`: `display:flex; gap: var(--space-2)`), so it was lost in that rename.
- Same rename orphaned a second rule, `.eval-form-card .form-actions { flex-shrink: 0 }` (`index.css:5500`), repointed here. It is inert, and correctly so: it lives in a `>=992px` block keyed on `.interview-grid`, a layout the Harbor redesign (#35) superseded. Repointing keeps the selector honest; it restores no behaviour.

## Decisions
- Scope: fix the gap and repoint the dead `.eval-form-card .form-actions` selector, same root cause (user confirmed).
- Branch prefix `fix/` despite the Improvements label, since this restores styling a rename dropped (user confirmed).
- Backlog's ApproveDraftAsync entry is a different area; left alone.

## Out of scope
- Removing the dead `.interview-grid` block, or deciding whether the height-capped scrolling card is still wanted. Either is a layout decision, not a spacing fix.
- The RG-72 `.eval-progress__count` nowrap entry: that is the card header, not this footer.

## Follow-ups
- `.interview-grid` and the `@media (min-width: 992px)` block at `index.css:5507-5560` are **dead CSS, not a broken feature**: the Harbor redesign (#35) replaced the two-panel grid with a full-width `.interview-studio-container` (itself an unstyled wrapper). Cleanup, not a defect. Correcting my own earlier reading of it.
- `responsive-card-header.spec.ts` skips its interview leg because E2E_INTERVIEW_ID's account is not an assigned interviewer; the new `E2E_INTERVIEWER_*` pair would let it run.
