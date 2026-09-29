<!-- phase: CONSTRUCT | branch: fix/RG-76/Eval-submitted-notification | tasks: 6/6
     base: cb89f36 | updated: 2026-09-30
     next: run dotnet test once Microsoft.NETCore.App 10.0.12 x64 is installed, then WRAP-UP -->
# Plan: notify Admin/SuperAdmin/owning Recruiters when an evaluation is submitted

Fix in the service layer, matching CandidateService and OfferService which both
dispatch through NotificationService.NotifyAsync from the service, not the controller.

## Tasks
- [x] Inject `NotificationService` into `InterviewService` (no DI cycle: NotificationService takes only AppDbContext + EmailService)
- [x] Add a private `NotifyEvaluationSubmittedAsync` that resolves recipients and fans out
- [x] Call it from `UpsertEvaluationAsync` after `SaveChangesAsync`, only when `dto.Submit`
- [x] Update `DbTestBase.Interviews()` for the new constructor arg
- [x] Add regression tests to `InterviewServiceEvaluationTests.cs`
- [x] Update `ai-docs/specs/interview-assignment-and-evaluation.md`

## Recipients (confirmed in CLARIFY, plus one refinement)
Active users, excluding the submitter, who are either
- SuperAdmin or Admin (any candidate), or
- Recruiter AND able to see this candidate: `c.OwnerUserId == u.Id` OR the candidate's
  `RoleAppliedOption.Recruiters` lists them — the same predicate as `CandidateService.ApplyAccess`.

Refinement, needs your yes: you asked to add Recruiters. `/candidates/{id}/evaluations` is
owner-scoped for Recruiters (`CandidatesController.ReadOwnerScope`), so a Recruiter who
does not own the candidate would get a notification linking to a 404. Scoping the Recruiter
fan-out to those who can see the candidate keeps every notification clickable.

## Notification
- Channel: in-app only, no email (`NotifyAsync` with the email args omitted)
- Title: `Evaluation submitted`
- Message: `{interviewerName} submitted an interview evaluation for {candidateName}.`
- Link: `/candidates/{candidateId}/evaluations`

## Tests — standard tier
`InterviewServiceEvaluationTests.cs` (MySQL fixture, existing harness):
- submit notifies Admin + SuperAdmin
- draft save (`Submit: false`) notifies nobody
- submitter who also holds Admin is not notified about their own submission
- a Recruiter who cannot see the candidate is not notified; the owning Recruiter is
Plus the full `dotnet test` suite and `npx tsc -b && npm test`.

## Files
- `server/Recruitment.Gorilla.API/Services/InterviewService.cs`
- `server/Recruitment.Gorilla.Tests/Infrastructure/DbTestBase.cs`
- `server/Recruitment.Gorilla.Tests/InterviewServiceEvaluationTests.cs`
- `ai-docs/specs/interview-assignment-and-evaluation.md`

## Not doing
- No email template, no frontend change (NotificationBell already renders whatever arrives)
- No DB migration: the `Notification` entity already fits
