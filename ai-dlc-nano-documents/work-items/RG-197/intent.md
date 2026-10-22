# Offer input is not validated: overlong fields 500, negative bonus and past expiry accepted
- Source: issue #197 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/197
- Type: bug
## Request
- Only BaseSalary > 0 is checked. Currency (10), JobTitle (200), Equity (200), Notes (2000) overflows throw DbUpdateException (500).
- Negative Bonus accepted and printed on the PDF letter; ExpirationDate before StartDate or in the past accepted.
- Wanted: service-side validation returning 400 (ISO 4217 currency, DB lengths, Bonus >= 0, ExpirationDate >= today and >= StartDate); mirror limits in the form; integration + Vitest tests.
## Decisions
- Service-side validation helper -> OfferRuleException (400), first error reported -> go with recommendation
- Currency 3 letters A-Z; lengths per DB; Bonus >= 0; salary/bonus <= 1e12; expiry >= today (UTC) and >= start -> go with recommendation
- Same rules on update; client mirrors maxLength/dates/bonus/currency -> go with recommendation
## Out of scope
- Offer state rules (RG-192/193/194).
## Follow-ups
