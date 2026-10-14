# Overall rating dropdown shows a duplicated "N - N -" value
- Source: issue #74 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/74
- Type: bug (label: bug; also Improvements, UI)

## Request
- Issue body is just a screenshot (Interview evaluation form, "Overall rating"
  dropdown): options read "1 - 1 - Unsatisfactory", "2 - 2 - Below
  Expectations", etc. - the number is duplicated.
- Root cause: `RATING_SCALE` entries in `evaluationCriteria.ts` already carry
  the number in `label` (e.g. `'1 - Unsatisfactory'`), but the dropdown's
  `<option>` template in `EvaluationForm.tsx:472-474` re-prepends
  `{r.value} - ` in front of `{r.label}`, producing the duplicate.
- The longer-than-intended text is also the likely cause of the "overlaps
  label on responsive view" symptom (same screenshot, same element).
- Other `RATING_SCALE` consumers (`title={r.label}` on the per-criterion
  rating buttons, `ratingTitle()` for `RatingDots` tooltips) use `r.label`
  alone and are already correct - not touched.

## Decisions
- (none needed - single unambiguous root cause, fast path)

## Out of scope
- No change to `RATING_SCALE` data itself; no change to other rating UI.

## Follow-ups
- none
