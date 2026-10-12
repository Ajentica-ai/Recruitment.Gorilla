# Add Status modal: double calendar icon in Firefox, and wrong 'skills selected' labels
- Source: issue #138 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/138
- Type: bug
## Request
- Bug 1: `DatePicker` (ui/date-picker.tsx) suppresses the native `type="date"` calendar icon
  with webkit-only CSS; Firefox has no equivalent, so Firefox shows its own icon plus our
  custom one. Confirmed via Playwright: Chromium 1 icon, Firefox 2 icons. Used in 4 places
  (AddStatusModal, CreateOfferModal, AuditLogPage, JobOpeningsTab).
- Bug 2: `SearchableDropdown`'s multi-select summary hardcodes "N skills selected"
  (SearchableSelect.tsx:202). Wrong at 3 of 8 call sites: AddStatusModal's Interview types
  and Interviewers, and JobOpeningsTab's Recruiters.
## Decisions
## Out of scope
## Follow-ups
