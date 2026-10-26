<!-- phase: WRAP-UP | branch: feature/RG-187/Share-earlier-rounds-on-booking | tasks: 10/10
     base: e9d40c4 | updated: 2026-10-22
     next: user yes to push + PR (Closes #187, Part of #182)
# Plan: RG-187 auto-share earlier rounds with the new panel (HIGH blast radius: migration + access grants)
## Tasks
- [x] Tests first (backend): booking with/without the flag, skip already-covered panelists, reschedule add/remove/toggle, cancel, manual grants untouched, peer rule for the current interview intact
- [x] Model + migration: Interview.ShareEarlierRoundsWithPanel (bool, default false), generated in a scratch copy on a throwaway DB (never touch the real DB)
- [x] EvaluationShareService (or EvaluationAccess helper): SyncPanelAutoSharesAsync(interview, panelIds, flag) creating/revoking PanelAutoShare grants (CreatedForInterviewId, audited), skipping full-access and already-covered users
- [x] Booking (CandidateService, StatusChangeDto.ShareEarlierRoundsWithPanel) and reschedule (RescheduleInterviewDto + InterviewScheduleDto flag for prefill); cancel revokes the auto grants
- [x] Interview assigned in-app + email: mention + link, only for panelists who got access (EmailTemplates.InterviewAssigned)
- [x] Options endpoint: earlierRoundsWithEvaluations (count of non-cancelled interviews with a submitted evaluation) + tests
- [x] Client: checkbox in AddStatusModal (Interview Scheduled) and RescheduleInterviewModal, shown only when earlierRoundsWithEvaluations > 0, unchecked by default, payload field, prefill on reschedule; types + api
- [x] Vitest: visibility, default unchecked, payload true/false, reschedule prefill
- [x] Docs: data-model.md, auth.md, backend.md, frontend.md, Recruiter guide section
- [x] dotnet test + npx tsc -b + npm test + lint, isolated real-stack check (own ports, throwaway DB, migration up), security review (grants), notes/backlog
## Tests
- High blast radius: failure and rollback paths, idempotent re-sync, no duplicate grants, manual grants never revoked.
## Files
- Models/Interview.cs, Migrations/*, Data/AppDbContext.cs (if needed), DTOs, Services/CandidateService.cs, InterviewService.cs, EvaluationShareService.cs, EmailTemplates.cs, Controllers/EvaluationSharesController.cs, tests; client: types, api.ts, AddStatusModal, RescheduleInterviewModal (+tests); ai-docs, UserGuide/chapter-2-recruiter.md
