<!-- phase: WRAP-UP | branch: fix/RG-327/Notification-links-localhost | tasks: 5/5
     base: 82f9f86 | updated: 2026-11-26
     next: push and open the PR (Closes #327) -->
# Plan: notification links follow the browser's origin
## Tasks
- [x] Failing tests: PublicLinksTests, Slack link via Origin, interview emails via Origin (fail on old code)
- [x] `Services/PublicLinks.cs` + middleware after UseAuthentication in Program.cs
- [x] Route the 5 link builders (Slack, InterviewService x2, CandidateService x2) through `PublicLinks.BaseUrl`
- [x] Docs: dev-setup, slack-notifications spec, compose comment, .env.example
- [x] Full `dotnet test` green (1085); real-process check on a scratch DB
## Tests
- Standard tier. xUnit: resolution order, Origin parsing, middleware, Slack + email links (PublicLinksStateCollection, serial).
- Real API with App__ClientBaseUrl=http://localhost:8090: booking with Origin -> email links use it, no localhost; old code reproduces the bug.
## Files
- Services/PublicLinks.cs, Program.cs, SlackService.cs, InterviewService.cs, CandidateService.cs
- Tests: PublicLinksTests.cs, NotificationLinkOriginTests.cs, SlackServiceTests.cs
- ai-docs/dev-setup.md, ai-docs/specs/slack-notifications.md, docker-compose.yml, .env.example
