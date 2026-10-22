# Overdue evaluation reminders and an 'all evaluations in' notification
- Source: issue #202 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/202
- Type: feature (label: enhancement)
## Request
- Background job: for non-cancelled interviews past ScheduledAt + DurationMinutes + N hours (default 24h), remind each assigned interviewer without a submitted evaluation, at most once per interval, max K reminders.
- When the last assigned interviewer submits, notify the booker and in-scope recruiters ("All evaluations in for <candidate> ..."), linking to the report.
- New notification categories (channel settings); optional dashboard badge.
## Decisions
- Scope: reminder job + "all evaluations in" + 2 categories; dashboard badge to backlog -> go with recommendation
- New EvaluationReminders table (count + last sent per interview/interviewer), EF migration -> go with recommendation
- appsettings EvaluationReminders:{Enabled,AfterHours=24,IntervalHours=24,MaxReminders=3,PollMinutes=15} -> go with recommendation
- All-in goes to booker + owner/assigned Recruiters (not Admins), once, on draft->submitted of the last panelist -> go with recommendation
## Out of scope
- Escalation to managers; SLA analytics.
## Follow-ups
