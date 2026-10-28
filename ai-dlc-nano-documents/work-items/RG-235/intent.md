# Decide whether evaluation reminders run on the first 2.1.0 deploy
- Source: issue #235 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/235
- Type: question (no code change either way)
## Request
EvaluationReminders:Enabled defaults to true. On first start after the 2.1.0 deploy, every interviewer with a
non-cancelled, overdue (>24h), unsubmitted evaluation from the last 14 days gets one reminder at once.
Decide: keep enabled for the first deploy, or set EvaluationReminders__Enabled=false and turn it on later.
## Decisions
- Keep EvaluationReminders:Enabled = true for the first deploy -> user confirmed; matches the current default, no code/config change needed
## Out of scope
- Code change (the issue is a config decision only).
## Follow-ups
