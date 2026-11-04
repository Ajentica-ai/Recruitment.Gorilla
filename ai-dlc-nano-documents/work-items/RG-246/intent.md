# Failed-login log and audit text uses raw unvalidated email
- Source: issue #246
- Type: bug
## Request
- On a failed sign-in, AuthController writes dto.Email directly into logger and audit summary
- CR/LF chars in the input forge extra log lines (log injection)
- Very long values bloat the log file and the AuditLogs.Summary column
- Fix: strip control characters (CR, LF, tab) and cap at 200 chars before logging/auditing
## Decisions
- Strip \r, \n, \t and truncate to 200 chars (matches issue spec and reasonable DB guard)
- Apply only to the logged/audited value; credential-check path (.Trim()) is unchanged
- Private SanitizeEmail helper in AuthController — pattern not shared elsewhere
## Out of scope
- Validating email format on login (intentional: error message must not reveal whether email exists)
