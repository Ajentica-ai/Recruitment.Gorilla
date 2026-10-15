<!-- phase: DONE | branch: fix/RG-37/Inactive-login-message | tasks: 6/6
     base: e65f126 | updated: 2026-10-15
     next: commit + PR on request -->
# Plan: RG-37 inactive login message (HIGH blast radius: auth)
## Tasks
- [x] Tests: inactive+correct pw -> inactive result; inactive+wrong pw, unknown email -> generic; active ok; controller 403 + audit
- [x] AuthService: verify password before IsActive; distinct result for inactive
- [x] AuthController: 403 {code:account_inactive,message}; audit reason
- [x] LoginPage: show the inactive message on 403 account_inactive
- [x] dotnet test + tsc + npm test; real-app check with a deactivated user; security-reviewer on the diff
- [x] ai-docs/auth.md
## Tests
- High blast radius: every gate (wrong pw, unknown, inactive, active) on service and controller, plus client test
## Files
- AuthService.cs, AuthController.cs, LoginPage.tsx (+tests), ai-docs/auth.md
