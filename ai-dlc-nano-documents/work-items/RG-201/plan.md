<!-- phase: DONE | branch: feature/RG-201/Backend-cleanups | tasks: 6/6
     base: 3062074 | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-201 six backend cleanups (improvement, standard; item 2 touches access control)
## Tasks
- [x] Repro tests first: rubric CreatedBy is the Admin's id; for-interview 404 for unassigned/out-of-scope users, 200 for Admin, assigned interviewer, in-scope Recruiter, grantee; create into ended opening 400 and update to one 400; update to an existing email 409 (unchanged email fine, AllowDuplicate ok)
- [x] EvaluationRubricsController: CurrentUser (item 1) + scope check on for-interview (item 2)
- [x] CandidateService: EndDate check on create and on role change (item 3); duplicate-email check on update (item 4; DTO AllowDuplicate)
- [x] CandidatesController: cheap scope checks (item 5)
- [x] NotificationService.MarkAllReadAsync ExecuteUpdate; OfferService.GetMetricsAsync one aggregate (item 6)
- [x] ai-docs notes; full dotnet + client suites; security review (item 2 is access control)
## Tests
- Standard; access-control paths tested both ways. Items 5 and 6 covered by existing tests plus a scope regression.
## Files
- EvaluationRubricsController.cs, CandidateService.cs, CandidatesController.cs, NotificationService.cs, OfferService.cs, DTOs, tests, ai-docs
