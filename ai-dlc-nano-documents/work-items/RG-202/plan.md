<!-- phase: DONE | branch: feature/RG-202/Evaluation-reminders | tasks: 7/7
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-202 overdue evaluation reminders + "all evaluations in" (feature, standard + migration)
## Tasks
- [x] Tests first: reminder due/not due, interval, max K, cancelled, submitted, draft, inactive user, no panel; all-in fires once on the last submit (not earlier, not on re-save), recipients booker + owner/assigned Recruiters
- [x] Entity EvaluationReminder (InterviewId, UserId, Count, LastSentAt, unique pair), AppDbContext mapping, EF migration (+snapshot)
- [x] EvaluationReminderService.SendDueAsync(now) + options from appsettings; categories EvaluationReminder and EvaluationsComplete in NotificationCategories
- [x] EvaluationReminderWorker (PeriodicTimer, scoped service per tick, errors logged not fatal) registered in Program.cs
- [x] InterviewService: all-in notification on the last panelist's first submit
- [x] appsettings defaults; ai-docs (backend.md, data-model.md) + user guide note; backlog: dashboard badge
- [x] Full dotnet + client suites; verify migration on a throwaway DB; security review
## Tests
- Standard with schema change: service tests with injected clock; migration applied to a scratch DB; worker smoke via service.
## Files
- Models/EvaluationReminder.cs, Data/AppDbContext.cs, Migrations/*, Services/EvaluationReminderService.cs, Services/Background/EvaluationReminderWorker.cs, NotificationCategories.cs, InterviewService.cs, Program.cs, appsettings.json, tests, ai-docs
