# Profile links open a broken in-app URL
- Source: issue #102 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/102
- Type: bug (labels `bug`, `UI`)
## Request
- LinkedIn/GitHub buttons on a candidate profile open `/candidates/linkedin.com/in/...` instead of the profile.
- Stored links often lack a scheme (CV extraction, draft form placeholder), so a raw `href` resolves relative to the page.
- Same defect in the other profile links and the status timeline submission link.
## Decisions (confirmed by user 2026-10-02)
- Fix at render time with a shared helper; no data migration, so existing candidates are fixed as-is.
- Bare links get `https://`; `http(s)://` pass through; any other scheme is not rendered as a link.
## Out of scope
- Normalizing URLs on save (server or forms).
## Follow-ups
- none
