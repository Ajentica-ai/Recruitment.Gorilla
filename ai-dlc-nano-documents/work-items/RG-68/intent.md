# Evaluation actions row has no spacing between Save draft and Submit evaluation

- Source: issue #68 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/68
- Type: Improvements / UI (no bug or enhancement label; branch prefix to confirm)

## Request
- The interview evaluation form's two footer buttons sit flush against each other. Issue body is a screenshot only, no text.

## Root cause (confirmed)
- `EvaluationForm.tsx:504-529` uses `eval-form-actions`, `eval-form-actions__hint` and `eval-form-actions__buttons`. **None of the three has any CSS rule.**
- Commit `33ed80a` (customizable rubrics, #24) renamed the row from `form-actions` to `eval-form-actions` and added the hint/buttons sub-structure, but never added the matching CSS. The gap came from `.form-actions` (`index.css:3470`: `display:flex; gap: var(--space-2)`), so it was lost in that rename.
- Same rename orphaned a second rule, `.eval-form-card .form-actions { flex-shrink: 0 }` (`index.css:5500`), repointed here. Correcting an assumption made at PLAN: repointing it changes nothing visible, because `flex-shrink` only bites once the card is height-capped, and both the cap and the sticky behaviour hang off `.interview-grid`, which no TSX applies. Found by writing the assertion and watching it fail against the fix.

## Decisions
- Scope: fix the gap and repoint the dead `.eval-form-card .form-actions` selector, same root cause (user confirmed).
- Branch prefix `fix/` despite the Improvements label, since this restores styling a rename dropped (user confirmed).
- Backlog's ApproveDraftAsync entry is a different area; left alone.

## Out of scope
- Making the >=992px sticky interview workspace actually work. The repointed selector is inert until `.interview-grid` is applied, which is a layout change, not a spacing fix.
- The RG-72 `.eval-progress__count` nowrap entry: that is the card header, not this footer.

## Follow-ups
- `.interview-grid` is defined in `index.css` (5518-5523) and applied in no TSX, so the whole >=992px two-panel sticky interview workspace, height cap and internal rubric scrolling never engage. `--detail-panel-max` is defined only there.
- `responsive-card-header.spec.ts` skips its interview leg because E2E_INTERVIEW_ID's account is not an assigned interviewer; the new `E2E_INTERVIEWER_*` pair would let it run.
