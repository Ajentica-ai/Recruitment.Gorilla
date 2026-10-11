<!-- phase: DONE | branch: fix/RG-74/Overall-rating-dropdown-duplicate-value | tasks: 1/1
     base: 509f84a | updated: 2026-10-11
     next: none. PR #144 open against develop @ea8e86c. -->
# Plan: Fix duplicated value in the Overall rating dropdown

## Tasks
- [x] `EvaluationForm.tsx` ~line 472-474: render `{r.label}` instead of
      `{r.value} ` followed by `{r.label}` for each `RATING_SCALE` option
      (label already contains the number).

## Tests
- Trivial text fix. Verify by observation: run the frontend, open an
  interview evaluation, check the Overall rating dropdown shows "1 -
  Unsatisfactory" etc. (no duplicate number). Existing
  `EvaluationForm.test.tsx` selects by value, not text, so unaffected -
  confirmed by reading it, not rerun-dependent to prove no regression, but
  will run it anyway since it's cheap.

## Files
- client/src/components/EvaluationForm.tsx
