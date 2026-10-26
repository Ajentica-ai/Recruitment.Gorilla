# Evaluation sharing 5/5: share earlier rounds with the next round's panel when booking
- Source: issue #187 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/187 (Part of #182, phase 5 of 5)
- Type: feature (backend + UI)
## Request
- Checkbox "Share earlier rounds' evaluations with this panel" on the Interview Scheduled status form and on RescheduleInterviewModal; shown only when an earlier interview has a submitted evaluation; unchecked by default.
- Store it on the booking: Interview.ShareEarlierRoundsWithPanel (bool, migration).
- Booking with the flag: per panelist, one PanelAutoShare grant per earlier non-cancelled interview (interview-specific), CreatedForInterviewId = the new interview.
- Reschedule: added panelists get grants, removed lose the auto grants (soft revoke, audited); flag off revokes all, on creates. Cancel revokes the auto grants for that interview. Manual grants never touched.
- "Interview assigned" email/in-app mentions earlier rounds are available, with a link.
- Tests: create / reschedule add-remove / flag toggle / cancel, peer rule intact, Vitest for checkbox visibility + payload. Docs: data-model.md, auth.md, recruiter guide.
## Decisions
- Checkbox visibility data → add earlierRoundsWithEvaluations to the share options endpoint (#185); a Recruiter's status history carries no evaluation info (user: go with recommendation)
- Panelists already covered (Admin, in-scope recruiter, any active covering grant) are skipped, no duplicates; only PanelAutoShare grants are ever revoked
- Auto grants never expire; end on cancel, panel removal, or flag off
- Notifications → no separate "shared with you" for auto grants; Interview assigned (in-app + email) gets a line + link /shared/candidates/{id}/evaluations, only for panelists who got access
- Tests → backend integration for create/reschedule add-remove/toggle/cancel + peer rule, Vitest for checkbox; no new Playwright spec, isolated-stack check instead
- Branch → feature/RG-187/Share-earlier-rounds-on-booking from origin/develop
## Out of scope
- New UI beyond the checkbox; changing manual share behaviour.
## Follow-ups
- Security review (no High) fixed here: manual share no longer reuses an auto row; hand revoke of an auto row refused (409, no UI button); cancel/reschedule + sync in one transaction; "earlier" also needs an earlier ScheduledAt; null actor allowed; audit lists round ids and the flag change; migration Down revokes auto grants.
- Left for the backlog: concurrency token on reschedule, covered panelists get no fallback auto row, auto grants outlive the interview, unencoded names in InterviewAssigned email (pre-existing).
