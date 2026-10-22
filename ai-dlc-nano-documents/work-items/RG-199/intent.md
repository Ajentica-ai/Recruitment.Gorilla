# Evaluation labels: 'Across N interviewers' counts evaluations, 'oldest awaiting' opens the newest
- Source: issue #199 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/199
- Type: bug (labels: bug, UI)
## Request
- Report summary InterviewerCount is reportEvals.Count (one per evaluation), printed as "Across N interviewers"; one person on two rounds shows as 2.
- UpNextCard badge title says "oldest interview awaiting your evaluation" but opens pending[0], and awaitingEvaluation sorts newest first.
## Decisions
- InterviewerCount = distinct InterviewerUserId (wording stays "interviewers") -> fast-path assumption
- Badge opens the oldest pending (last item); hero chip left as is (it does not claim "oldest") -> fast-path assumption
## Out of scope
- Showing rounds count; hero chip target.
## Follow-ups
