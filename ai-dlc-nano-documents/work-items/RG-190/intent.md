# Evaluation report hides every rating given on a custom rubric
- Source: issue #190 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/190 (pairs with #188 / PR #215; long-term snapshot is #165)
- Type: bug (UI + report API)
## Request
- On the candidate evaluation report (page, drawer, shared view) each interviewer card shows the 12 built-in criteria as "-" when the evaluation used a custom rubric: EvaluationReportBody renders EvaluationReadOnly with no rubric, rubricToSections(undefined) falls back to EVALUATION_SECTIONS and only items with those keys are drawn. The per-criterion averages also come from the built-in keys only (client CRITERION_ORDER/LABELS and the server's EvaluationCriteria.Keys loop).
- Same silent hiding on InterviewPage once the rubric or opening changes after scoring.
- Expected: every rated item visible, with the criterion's label and section, on every view. Fix: report DTO carries the criteria scored on (key, label, section) and the client renders from it; stopgap: EvaluationReadOnly renders any item key not in the sections under "Other criteria" using the key as the label.
- Tests: Vitest custom keys render their ratings; unknown keys fall into "Other criteria".
## Decisions
- Approach (user: go with recommendation): the report DTO carries the criteria (key, label, section) of the candidate's current rubric, resolved once per report, plus any rated key the rubric does not know under "Other criteria" labelled by key; per-criterion averages cover every rated key; EvaluationReadOnly gets the same "Other criteria" safety net so InterviewPage is fixed without a new request
- Labels are the rubric as it is now, not a snapshot (that is #165); until PR #215 (#188) merges a UI-created candidate resolves to the default rubric, so custom ratings show under "Other criteria" with key labels
- Branch → fix/RG-190/Custom-rubric-ratings-in-report from origin/develop
## Out of scope
- Snapshotting the rubric on submit (#165); the rubric lookup itself (#188, PR #215).
## Follow-ups
- No separate HTTP test: the fixture helper for a custom-rubric opening lives in the open PR #215; the JSON shape was checked on an isolated stack instead.
