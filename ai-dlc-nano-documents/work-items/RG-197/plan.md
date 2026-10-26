<!-- phase: DONE | branch: fix/RG-197/Offer-input-validation | tasks: 5/5
     base: f4c994b | updated: 2026-10-25
     next: none, committed locally, awaiting push/PR approval -->
# Plan: RG-197 validate offer input, 400 not 500 (bug, standard)
## Tasks
- [x] Repro tests (HTTP + service): overlong title/currency/equity/notes, bad currency, negative bonus, huge salary, expiry in past or before start; valid input and edits still work
- [x] OfferInputValidator (service layer): rules above, throws OfferRuleException; called by Create and Update before any write
- [x] Controller: drop the lone BaseSalary check in favour of the validator; keep 400 mapping
- [x] CreateOfferModal: maxLength, bonus/date/currency messages (+ Vitest)
- [x] ai-docs/auth.md or backend.md note; full dotnet + client suites; verify via real API
## Tests
- Standard: failing tests first and kept; Vitest for form messages.
## Files
- Services/OfferInputValidator.cs (new), OfferService.cs, OffersController.cs, CreateOfferModal.tsx(+test), tests, ai-docs
