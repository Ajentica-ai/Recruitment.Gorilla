# Allow Recruiters and Super Admins to reschedule an interview to a past date/time
- Source: issue #263 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/263
- Type: feature
## Request
- Recruiter and Super Admin may reschedule (and book via Add Status) to a past time, with a mandatory reason. Admin keeps future-only (400 / validation error).
- Past times send no calendar invite, email or Slack; in-app notification to interviewers only.
- Record a RescheduledBackdated event (previous, new, actor, reason) + audit row, shown on the timeline.
- Lower bound: not before the candidate's creation, nor the status entry the interview follows.
- Existing guards stay: cancelled, submitted evaluation, status past Interview Scheduled, job-opening lock.
## Decisions
- Recruiter or Super Admin (even if also Admin) may back-date; pure Admin may not -> yes
- Add Status uses the existing Comment as the required reason -> yes
- Lower bound: candidate creation and the preceding status entry; reminders keep their 14-day lookback -> yes
## Out of scope
- Moving to Interview Completed automatically; changing the evaluation reminder window.
## Follow-ups
