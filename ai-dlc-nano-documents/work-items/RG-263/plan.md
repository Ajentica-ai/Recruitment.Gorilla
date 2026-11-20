<!-- phase: DONE | branch: feature/RG-263/Backdated-interview-reschedule | tasks: 7/7
     base: d63670d | updated: 2026-11-17
     next: none -->
# Plan: Back-dated interview reschedule (#263)
## Tasks
- [x] xUnit first (RescheduleBackdatedTests): Recruiter/SuperAdmin ok with reason; no reason 400; Admin 400; Interviewer 403; below lower bound 400
- [x] InterviewService.RescheduleAsync: role-aware past rule, reason required, RescheduledBackdated event + audit, in-app-only notices (no email/calendar/Slack)
- [x] CandidateService add-status Interview Scheduled: same rule (Admin error, past needs Comment as reason), no invites for past
- [x] Past booking sends nothing outward: tests assert no email/Slack/calendar; in-app notice only
- [x] Client: modal allows past for Recruiter/SuperAdmin, inline note, reason required; Admin keeps error; AddStatusModal same; timeline shows the event (Vitest)
- [x] Docs: ai-docs backend/frontend, UserGuide chapter; full dotnet + vitest, tsc, oxlint
- [x] Verify in browser (scratch API/DB) and check evaluation reminder treats the new time as interview time
## Tests
- High blast radius (permissions + notifications): xUnit per role, failure paths, no-outbound assertions; Vitest for modal and timeline.
## Files
- Services/InterviewService.cs, CandidateService.cs, Models/InterviewStatuses.cs, DTOs (maybe); RescheduleInterviewModal.tsx, AddStatusModal.tsx, StatusTimeline.tsx; tests; ai-docs; UserGuide
