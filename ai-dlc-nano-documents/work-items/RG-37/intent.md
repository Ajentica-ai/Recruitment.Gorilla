# Inactive account login shows "Invalid email or password."
- Source: issue #37 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/37 (labels bug, Improvements, UI)
- Type: bug
## Request
- Correct email and password on an inactive account shows the generic invalid-credentials message.
- Wanted: "Your account is inactive. Please contact your administrator."
## Decisions
- Reveal "inactive" ONLY after the password is verified, so unknown emails and wrong passwords stay generic (no account enumeration) (user confirmed)
- Respond 403 with code account_inactive + message; 401 stays for bad credentials (user confirmed)
- Message text exactly as above (user confirmed)
## Out of scope
- Timing difference for unknown emails (no hash verify), lockout, rate limiting.
## Follow-ups
