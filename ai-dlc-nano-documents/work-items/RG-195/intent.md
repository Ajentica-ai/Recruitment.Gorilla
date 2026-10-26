# Candidates list ignores the batch filter and the hired/offers buckets
- Source: issue #195 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/195
- Type: bug
## Request
- `?batch=` is sent by the client and supported by CandidateService, but CandidatesController.GetAll has no batch parameter, so it is never applied.
- CandidateBuckets.IsKnown accepts `hired` and `offers`, but GetAllAsync has no case for them (falls through to all candidates).
- Wanted: batch param passed through; implement Hired/Offers (or remove them); integration tests.
## Decisions
- Batch: add `batch` query param, pass Batch -> go with recommendation
- hired = status Hired; offers = Offer Preparation/Extended/Accepted (Declined stays Rejected) -> go with recommendation
- Client: add Hired/Offers chip labels, no new dashboard tiles -> go with recommendation
## Out of scope
- New dashboard tiles for hired/offers.
## Follow-ups
