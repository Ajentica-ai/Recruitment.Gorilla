# Forced password change is not enforced on any API endpoint (only on the client)
- Source: issue #264 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/264
- Type: bug (security, priority high)
## Request
- PasswordChangedRequirement is only on FallbackPolicy, which ASP.NET applies to endpoints with NO authorization metadata. Every controller has [Authorize], so a user with must_change_password can call every endpoint.
- Make the requirement apply to DefaultPolicy so [Authorize] and [Authorize(Roles=...)] both enforce it. Keep the allow-list (change-password).
- Tests: must-change user gets 403 on candidates, dashboard KPIs, my interviews; change-password succeeds, then the same calls are 200.
## Decisions
- Client shell polling queries gated while a password change is pending -> yes (user: go with recommendation)
## Out of scope
- Rate limiting on login (noted in ai-docs/auth.md).
## Follow-ups
