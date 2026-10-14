# Relevant Experience defaults to "3-5 Years" after CV parse
- Source: issue #56 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/56
- Type: bug
## Request
- After upload + parse, Pending review shows Relevant Experience "3-5 Years" even when the CV shows ~10 years.
- Expected: value reflects the experience in the CV.
## Decisions
- Root cause: parser never sets RelevantExperience; DraftReviewWorkspace.tsx:236 falls back to hardcoded '3-5 Years'.
## Out of scope
- Re-parsing existing drafts.
## Follow-ups
