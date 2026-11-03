# Deactivated user's token keeps working until expiry (RG-245)
- Source: issue #245 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/245
- Type: bug
## Request
- Deactivating a user does not revoke their refresh tokens; they stay usable for up to 7 days.
- JWT middleware never checks user.IsActive, so an access token (15 min window) still works
  after the user is deactivated.
- Fix: (1) revoke refresh tokens in UserService.UpdateAsync on deactivation; (2) add
  OnTokenValidated hook that checks user.IsActive from the DB and fails the context.
## Decisions
- Token validation: use JwtBearerEvents.OnTokenValidated (one lightweight DB SELECT per
  authenticated request) — acceptable for a small-team app; no in-memory cache needed.
- Refresh revocation: ExecuteUpdateAsync to bulk-set RevokedAt after SaveChangesAsync.
  Order: save user first, then revoke tokens. If revocation fails, the existing RefreshAsync
  IsActive check still rejects on the next attempt.
- Tests: service-level for the revocation, HTTP-level (integration) for the 401 behavior.
## Out of scope
- In-memory token blacklist / Redis cache
- Evaluation-share grants outliving deactivation (tracked separately: RG-184 in backlog)
