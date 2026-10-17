<!-- phase: DONE | branch: feature/RG-173/Interview-reschedule-cancel | tasks: 15/15
     base: fe76b20 | updated: 2026-10-16
     next: none - complete, uncommitted on feature/RG-173/Interview-reschedule-cancel -->
# Plan: Move or cancel a scheduled interview (#173)
Design: `ai-docs/specs/interview-reschedule-and-cancel.md`. Playbook steps 1-11.
## Tasks
- [x] 1. `Interview` gains Status/UpdatedAt/UpdatedByUserId/CalendarSequence/Notes; new `InterviewEvent` model + AppDbContext config, index, transition Id 50 in `HasData`
- [x] 2. Migration `AddInterviewLifecycle`: columns, table, and an explicit insert of transition 50 for existing DBs (precedent: Id 31)
- [x] 3. DTOs: `InterviewScheduleDto`, `RescheduleInterviewDto`, `CancelInterviewDto`, `InterviewEventDto`; `StatusHistoryDto` gains InterviewScheduledAt/InterviewStatus/InterviewEvents
- [x] 4. `CalendarInvite`: `Sequence` on `InterviewInviteDetails`, `Build(d, cancelled)` with METHOD:CANCEL + STATUS:CANCELLED + ORGANIZER, matching `CalendarAttachment.Method`
- [x] 5. `NotificationCategories` + `EmailTemplates.InterviewRescheduled` / `InterviewCancelled`
- [x] 6. `InterviewService.GetScheduleAsync` / `RescheduleAsync` / `CancelAsync`: owner scope, the 8 rules from spec §6, InterviewEvent writes, draft deletion, audit entries, recipient split
- [x] 7. Write a `Scheduled` event in `CandidateService.AddStatusAsync` at creation; `GetByIdAsync` includes `Interviews.Events`; `ToStatusHistoryDto` fills the new fields
- [x] 8. Filter `Status != "Cancelled"` in `InterviewService.GetMineAsync` and the dashboard upcoming query
- [x] 9. Controller: `GET /{id}/schedule`, `PUT /{id}`, `POST /{id}/cancel`, each `[Authorize(Roles = Roles.CanWriteCandidate)]` except the GET
- [x] 10. Server tests: CalendarInvite, new `InterviewScheduleServiceTests`, CandidateServiceStatus, ControllerAuthorization, EmailTemplates, SlackSettingsService, InterviewDetailApi
- [x] 11. Client types + `api.ts` (getInterviewSchedule, rescheduleInterview, cancelInterview); lift `DURATION_OPTIONS` to a shared constant
- [x] 12. `RescheduleInterviewModal.tsx` + cancel via `ConfirmModal` with a required-reason `Textarea`
- [x] 13. `StatusTimeline` actions, headline date, "rescheduled from" sub-line, Cancelled badge; `InterviewPage` hero action + chip; `CandidateDetailPage` passes `canManageInterview`
- [x] 14. Client tests: new `RescheduleInterviewModal.test.tsx`, extend `StatusTimeline.test.tsx`; Playwright e2e for the reschedule flow
- [x] 15. Docs: the 5 `ai-docs/` files, `cv-to-hired-pipeline.html` (3 -> 2 edge), the UserGuide page, specs README index row
## Tests
Standard-to-high: a migration, an auth gate and a deletion path (dropped drafts). Full `dotnet test`
+ `npm test` + `tsc` + lint each run; e2e once at the end; the 409/400 refusal paths all tested.
## Files
`Models/Interview.cs`, `Models/InterviewEvent.cs`, `Data/AppDbContext.cs`, `Migrations/`,
`DTOs/`, `Services/{InterviewService,CandidateService,CalendarInvite,EmailTemplates,NotificationCategories,DashboardService}.cs`,
`Controllers/InterviewsController.cs`, `Tests/` (7 files), `client/src/{types,services/api,components,pages}`, `client/e2e/`, `ai-docs/`.
