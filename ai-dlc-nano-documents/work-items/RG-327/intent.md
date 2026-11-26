# Slack and email notification links point to localhost on the deployed server
- Source: issue #327 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/327
- Type: bug
## Request
- Slack "Open in Recruitment Gorilla" and the interview email links (incl. calendar links) read `http://localhost:8090/...` in production.
- Cause: CD deploys on the committed compose defaults with no `.env` (cd.yml), so `App__ClientBaseUrl` = `${PUBLIC_ORIGIN:-http://localhost:8090}`.
- Proxy headers can't name the public URL: host nginx ends TLS, the web container's nginx resets `Host` ($host) and `X-Forwarded-Proto` ($scheme = http).
## Decisions
- Fix in code only, no server `.env` change (user: env changes need the DevOps process).
- Browser `Origin` header is the fallback source (option A, user confirmed); a real configured URL still wins; localhost config = unset.
- Origin from signed-in requests is remembered for background work (reminders); anonymous requests can't set it.
- No link rather than a localhost link when nothing is known. No deploy-script guard (not needed with this design).
## Out of scope
- Messages already sent keep their localhost links.
- Gorilla HR's X-Forwarded-Host design: does not fit (proto rewritten to http by our nginx).
## Follow-ups
- A signed-in user could forge `Origin` from a script to steer links in notifications they trigger; low risk (staff only).
