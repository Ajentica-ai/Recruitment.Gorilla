# Offer actions change candidate status without transition rules or the End Date lock
- Source: issue #193 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/193
- Type: bug
## Request
- Create/Extend/RecordDecision call AddStatusAsync directly: no transition rules, no job-opening End Date lock.
- Extending for a Reject/Hired candidate moves them to Offer Extended; Create accepts any status.
- Several open offers per candidate are allowed; a double Extend click can write duplicate timeline rows.
- Wanted: lock + status precondition (400), one non-terminal offer per candidate (409), validated moves, double click is a 409.
## Decisions
- Create only from Recommended/Offer Preparation/Offer Extended; other statuses 400 -> go with recommendation
- At most one non-terminal offer per candidate (Draft, PendingApproval, Approved, Extended): 409 -> go with recommendation
- Status moves go through ValidateStatusChangeAsync before the offer is written -> go with recommendation
- End Date lock checked first on every offer mutation (400); double Extend is a 409 -> go with recommendation
## Out of scope
- RG-192 state machine (PR #219), already handled.
## Follow-ups
