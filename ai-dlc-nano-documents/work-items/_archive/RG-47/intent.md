# "View All" in Active Job Openings goes to Evaluation Rubrics
- Source: issue #47 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/47
- Type: bug
## Request
- Dashboard > Active job openings > "View all" opens Configuration (Evaluation Rubrics tab); should open the Job Openings page (/jobs).
## Decisions
- Root cause: ActiveJobOpeningsTable.tsx links to /configuration instead of /jobs → retarget to /jobs (assumed, pending confirm)
## Out of scope
- Changing the Jobs page itself
## Follow-ups
- none yet
