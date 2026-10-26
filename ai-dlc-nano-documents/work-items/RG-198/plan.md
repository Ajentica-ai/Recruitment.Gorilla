<!-- phase: DONE | branch: fix/RG-198/Dead-end-links | tasks: 5/5
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-198 no links to pages the viewer cannot open (bug, standard)
## Tasks
- [x] Repro tests: Vitest pills (owning Recruiter sees text, Admin and the interviewer see links), RequireRole toast; backend booker fan-out (access kept: link, removed from opening: no link, Admin: link)
- [x] StatusTimeline: pill is a Link only if canViewEvaluations or iv.userId === currentUserId; CandidateDetailPage passes the user id
- [x] InterviewService.NotifyBookerAsync: link only when the booker can still see the candidate (shared access check mirroring ApplyAccess)
- [x] RequireRole: toast once when it redirects
- [x] ai-docs note; full dotnet + client suites
## Tests
- Standard: failing tests first and kept; Vitest for UI, xUnit for the fan-out.
## Files
- StatusTimeline.tsx, CandidateDetailPage.tsx, RequireRole.tsx(+tests), InterviewService.cs, InterviewService tests, ai-docs
