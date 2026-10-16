# Analytics: Recruiter sees no job openings in the "All Job Openings" dropdown
- Source: issue #53 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/53
- Type: bug (label: bug)
## Request
- As a Recruiter, Analytics > "All Job Openings" lists no openings (only "All Job Openings"); Admin/SuperAdmin see them. No expected result stated.
## Decisions
- Finding: not a defect in the dropdown. It calls GET /candidates/role-filter-options, which for a non-admin returns only openings that name the caller as an assigned recruiter (ConfigurationService.GetAssignedRolesAsync; scoping from #10/#50, ai-docs/auth.md). A Recruiter with no assignments gets none.
- Tested by user in the browser: Recruiter sees none until assigned to an opening in Configuration, then sees only that one -> confirmed; closing as working as designed (option 1)
## Out of scope
- Widening Recruiter access to all openings (conflicts with the scoping rule)
## Follow-ups
- none yet
