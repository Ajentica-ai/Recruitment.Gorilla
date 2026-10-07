# Recruiter can reach Upload CVs and Candidates
- Source: issue #50 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/50
- Type: bug
## Request
- Body is a screenshot only: a Recruiter's sidebar with "Upload CVs" and "Candidates" circled.
- Two readings. (a) Recruiters should not reach these pages at all. (b) Recruiters could act on
  other users' CVs and candidates.
- (b) is fixed on develop: #103 scoped CV drafts to their uploader, #106 the create-time CV
  reference, #104 offers. Candidates were already scoped (own OR assigned-role).
- (a) contradicts ai-docs/auth.md, where Recruiters create/upload and work their own candidates.
## Decisions
- DB password for local runs -> user supplied it; passed per process via env vars, secrets untouched
- Which reading? -> (a) is by design; keep Recruiter access, verify (b) on develop, then close #50
## Out of scope
- Changing the role model or hiding nav items for Recruiters.
## Follow-ups
- Local user-secrets DB password is stale (root works); update it so the API and tests start.
