# Offer endpoints: 500 on status conflicts, and writes commit before the URL's candidate id is checked
- Source: issue #194 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/194
- Type: bug
## Request
- Extend/RecordDecision wrong-status errors escaped as 500 (only Review caught them).
- Update/Submit/Extend/RecordDecision write, audit and move status, then compare candidateId (write then 404). PDF never checks it.
- Wanted: candidateId passed into each service method and checked before any write (404); 409 on status conflicts; tests per action + PDF.
## Decisions
- Part 1 (409 mapping) is already done by RG-192 (#219) and RG-193 (#220): not redone, only pinned by a test.
## Out of scope
- Offer rules/state machine (RG-192, RG-193).
## Follow-ups
