# Specs

Feature specifications. Write one **before** implementing a non-trivial feature, using [../spec-template.md](../spec-template.md).

## Why
A spec captures the intent, data/API contract, and acceptance criteria so any agent can implement it consistently (and review against it afterward). It also leaves a durable record of *why* a feature is shaped the way it is.

## Convention
- One file per feature: `specs/<kebab-case-feature-name>.md`.
- Keep the `Status` field current: `Draft → Approved → Implemented`.
- When implemented, link the spec from the relevant `ai-docs/` reference doc if it changes the architecture, data model, or API surface.

## Index
| Spec | Status | Notes |
|---|---|---|
| [example-candidate-notes.md](example-candidate-notes.md) | Example | Worked example demonstrating the template + full-stack flow. Not necessarily implemented. |
| [database-backed-status-options.md](database-backed-status-options.md) | Implemented | Status dropdown values now come from the database. |
| [candidate-profile-fields-and-references.md](candidate-profile-fields-and-references.md) | Implemented | Add GitHub/Portfolio/role fields + a single reference section to the candidate profile. |
| [candidate-ux-validation-config-and-preview.md](candidate-ux-validation-config-and-preview.md) | Implemented | Login cleanup, frontend validation, config-backed role/skills, status colors, and CV preview. |
| [recruitment-dashboard-and-job-openings.md](recruitment-dashboard-and-job-openings.md) | Implemented | Dashboard landing page (KPIs, charts, activity) + Active Job Openings backed by role posting fields. |
| [interview-assignment-and-evaluation.md](interview-assignment-and-evaluation.md) | Implemented | Assign interviewers on Interview Scheduled, in-app notifications, and per-interviewer evaluation forms (draft → submit-lock). |
| [job-openings-and-role-hierarchy.md](job-openings-and-role-hierarchy.md) | Implemented | Job-opening fields + required End Date lock, SuperAdmin-only delete, Viewer→Interviewer hierarchy & menu gating, dashboard hero. |
| [interview-completion-and-reschedule.md](interview-completion-and-reschedule.md) | Implemented | Interview Completed gate (≥1 submitted), evaluation summary + Admin-only link on the timeline, re-schedule transition, and recruiter notes shown to interviewers. |
| [json-candidate-import.md](json-candidate-import.md) | Implemented | Admin+ imports candidates from a JSON file (template with fill-in instructions in comments) plus their CVs, as Pending drafts for review. |
| [slack-notifications.md](slack-notifications.md) | Implemented | Slack bot DMs for interview assigned, evaluation submitted, and recruiter assigned to a job opening; per-category routing, SuperAdmin-only settings. |
| [email-outbox-and-notification-api.md](email-outbox-and-notification-api.md) | Implemented | Durable DB-backed email outbox + delivery log with Resend, plus a second HTTP notification-API provider (idempotency key, status-check-before-resend) alongside SMTP. |
| [in-app-user-guide.md](in-app-user-guide.md) | Implemented | User guide rendered as a native page, chapters cut to the reader's role, reachable from the sidebar and avatar menu. |
