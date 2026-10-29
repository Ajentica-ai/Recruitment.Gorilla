# E2E drawer-forms spec is out of date after the offer rules (#193)
- Source: issue #238 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/238
- Type: bug
## Request
- `drawer-forms.spec.ts` ("all four are usable at phone / short laptop") seeds a candidate at
  Uploaded and waits for Draft Offer, but #193 only allows that button for Recommended, Offer
  Preparation or Offer Declined, so both viewport tests time out.
- Fix: advance the seeded candidate to an offer-eligible stage before opening that form.
## Decisions
- Assumption: advance through the real pipeline (Uploaded -> Call for Interview -> Interview
  Scheduled -> submit one evaluation -> Interview Completed -> Recommended) via the API, the same
  way `shared-with-me.spec.ts` already does for its own setup, rather than seeding Recommended
  directly, since only Uploaded/Reject/Not Available/Discontinued are IsInitial status options.
## Out of scope
- The other three forms (add status, rubric editor, job opening editor) are unaffected.
