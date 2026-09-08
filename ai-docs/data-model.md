# Data Model

Entities live in `server/Recruitment.Gorilla.API/Models/`; mapping/constraints are in `server/Recruitment.Gorilla.API/Data/AppDbContext.cs`. Database: MySQL `RecruitmentGorilla`.

## Entities & relationships
```
Candidate 1───* CVFile          (cascade delete)
Candidate 1───* StatusHistory   (cascade delete)
User 1───* UserRole             (cascade delete; auth)
User 1───* Candidate            (Candidate.OwnerUserId, set null on delete)
RefreshToken    (standalone; auth)
StatusOption    (standalone lookup)
StatusOption 1───* StatusTransition (from/to lookup)
RoleAppliedOption (standalone lookup)  ── Candidate.RoleAppliedOptionId (restrict)
SkillOption       (standalone lookup)
Candidate *───* SkillOption  via CandidateSkill (cascade from Candidate, restrict on SkillOption)
Candidate 1───* Offer          (cascade delete)
Offer 1───* OfferApproval      (cascade delete)
```

### Candidate (`Candidates`)
The core profile. Holds a **denormalized `CurrentStatus`** for fast list queries, while the full history lives in `StatusHistory`.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | auto |
| FullName | varchar(200) | required |
| Email | varchar(200) | required; used for duplicate detection |
| Phone | varchar(50) | nullable |
| CurrentTitle | varchar(200) | nullable |
| RelevantExperience | varchar(100) | **required** free text (e.g. "3 Years"); existing rows backfilled to "0 Years" by migration `AddCandidateRelevantExperience` |
| Skills | text | nullable |
| Summary | text | nullable |
| LinkedInUrl | varchar(500) | nullable |
| GithubUrl | varchar(500) | nullable; auto-parsed from CV when present |
| PortfolioUrl | varchar(500) | nullable |
| AppliedRole | varchar(150) | nullable; legacy free-text role (kept for back-compat; forms now use RoleAppliedOptionId) |
| RoleAppliedOptionId | int? FK → RoleAppliedOption | nullable; configured role the candidate is interviewing for |
| OwnerUserId | int? FK → User | nullable; set to the creating Recruiter's id for per-role scoping (SetNull on user delete). Legacy/admin-created rows are NULL |
| IsReferred | bool | default false |
| ReferenceName | varchar(200) | nullable; required when IsReferred |
| ReferenceEmail | varchar(200) | nullable; required (+valid) when IsReferred |
| ReferenceEmployeeId | varchar(100) | nullable |
| CurrentStatus | varchar(100) | required; mirrors latest StatusHistory.Status |
| BatchId | varchar(100) | nullable; links to upload batch |
| BatchName | varchar(255) | nullable; intake batch label (e.g. "Q3 Senior Engineering Intake") |
| CreatedAt / UpdatedAt | datetime | UTC |

> Reference fields are cleared server-side when `IsReferred` is false. The reference rule (name + valid email required when referred) is enforced on **both** create and update via `CandidateService.ValidateReference`. Distinct `AppliedRole` values are served from `GET /api/candidates/roles` for the role suggestions dropdown.

### CVFile (`CVFiles`)
One row per uploaded file. The physical file is on disk under `Uploads/` as `{GUID}{ext}`; the DB keeps the mapping and original name.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| CandidateId | int FK → Candidate | cascade delete |
| OriginalFileName | varchar(500) | as uploaded |
| StoredFileName | varchar(500) | `{GUID}.pdf`/`.docx` on disk |
| FileType | varchar(10) | `"PDF"` or `"Word"` |
| FileSizeBytes | bigint | |
| UploadedAt | datetime | |

### StatusHistory (`StatusHistories`)
**Append-only** audit log of status changes; never updated/deleted (except via candidate cascade). The timeline UI reads this newest-first.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| CandidateId | int FK → Candidate | cascade delete |
| Status | varchar(100) | required; selected from active workflow options when appended |
| Comment | text | nullable |
| TaskDetails | varchar(1000) | nullable; used for Technical Assessment |
| SubmissionUrl | varchar(1000) | nullable; used for Submission Received |
| InterviewAt | datetime | nullable; used for Interview Scheduled |
| ChangedAt | datetime | |
| ChangedBy | varchar(200) | required; admin name/email |
| InterviewId | int? FK → Interview | SetNull; set only on the **Interview Completed** entry to link it to the interview it summarizes (migration `AddInterviewCompletionLinkAndReschedule`) |

The `StatusHistoryDto` returned by the API carries `InterviewId` for both the **Interview
Scheduled** entry (resolved by matching `Interview.StatusHistoryId`) and the **Interview Completed**
entry (from the stored `InterviewId` column), so the timeline can link to `/interviews/:id`; the
scheduled entry additionally carries `Interviewers` (name list). A completed entry surfaces a **live,
structured** per-interviewer evaluation summary (`StatusHistoryDto.EvaluationSummaries`: name, overall
rating, recommendation, submitted date), resolved from the linked interview's submitted evaluations —
rendered as cards on the timeline, not stored on the row.

### AuditLog (`AuditLogs`)
**Append-only** "who changed what, when" (migration `AddAuditLog`; never updated/deleted). Written by `AuditService` at write points across the app. Fields: `Id`, `Timestamp` (UTC), `ActorUserId` (int?, null for anonymous/failed-login), `ActorName` (display name or attempted email), `Action` (dotted verb — `Candidate.Deleted`, `Auth.LoginFailed`, `User.PasswordReset`, `Role.Updated`, …), `EntityType`/`EntityId` (nullable), `Summary` (human one-liner), `Details` (optional JSON — **never** secrets). Indexes on `Timestamp`, `ActorUserId`, `(EntityType, EntityId)`. Queried (Admin+) via `GET /api/audit`. Contains PII (candidate names/emails) so access is Admin+ only.

### RefreshToken (`RefreshTokens`)
Server-side store for auth refresh tokens (rotation + revocation). Only the **SHA-256 hash** of the opaque token is stored. See [auth.md](auth.md).

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| TokenHash | varchar(100) | unique index; SHA-256(token) base64 |
| Username | varchar(200) | holds the **user id** (string); refresh re-loads that user to rebuild claims |
| ExpiresAt / CreatedAt | datetime | |
| RevokedAt | datetime? | set on rotation or logout |
| ReplacedByTokenHash | varchar(100)? | rotation audit trail |
| IsActive | (computed) | `RevokedAt == null && now < ExpiresAt`; `[NotMapped]` via `Ignore` |

### User (`Users`)
Application accounts. Login is by **email**. See [auth.md](auth.md).

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| Name | varchar(200) | required; display name |
| Email | varchar(200) | required; **unique** index; login identifier |
| PasswordHash | varchar(400) | PBKDF2 `iterations.salt.hash` |
| MustChangePassword | bool | true after creation / admin reset; forces change on first login |
| IsActive | bool | default true; soft-deactivate (no hard delete) |
| CreatedByUserId | int? | self-reference to the creating admin (no FK constraint) |
| LastLoginAt | datetime? | set on successful login |
| CreatedAt / UpdatedAt | datetime | UTC |

### UserRole (`UserRoles`)
One row per role a user holds (a user may have several). Unique index `(UserId, Role)`; cascade-delete from User.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| UserId | int FK → User | cascade delete |
| Role | varchar(50) | one of `SuperAdmin`, `Admin`, `Recruiter`, `Interviewer` — hierarchy top→bottom (see `Auth/Roles.cs`; the former `Viewer` was renamed by migration `RenameViewerRoleToInterviewer`) |

### StatusOption (`StatusOptions`)
Lookup table for candidate status dropdown values. Candidate and history rows still store the status text so historical labels remain readable even if configuration changes later.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| Name | varchar(100) | required; unique |
| SortOrder | int | dropdown order |
| IsInitial | bool | allowed as an initial upload/review status |
| IsActive | bool | inactive options are hidden from dropdowns |
| CreatedAt | datetime | UTC |

### StatusTransition (`StatusTransitions`)
Lookup table for allowed movement from one status option to another. The UI hides statuses that are not valid next steps, and the API enforces the same rule.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| FromStatusOptionId | int FK → StatusOption | required |
| ToStatusOptionId | int FK → StatusOption | required |
| SortOrder | int | next-status dropdown order |
| IsActive | bool | inactive transitions are hidden/blocked |

Seed includes `Interview Completed → Interview Scheduled` (Id 31, migration
`AddInterviewCompletionLinkAndReschedule`) so a second interview round can be scheduled.

### RoleAppliedOption (`RoleAppliedOptions`), SkillOption (`SkillOptions`) & CandidateSourceOption (`CandidateSourceOptions`)
Admin-managed lookups (via the Configuration page / `/api/config/*`). Each: `Id`, `Name` (unique, ≤200), `SortOrder`, `IsActive`, `CreatedAt`, `UpdatedAt`. Inactive values are hidden from candidate forms but kept for history. All are seeded with starter values.

**`CandidateSourceOption`** records where a candidate came from (migration `AddCandidateSource`), seeded with employee referral, job board, LinkedIn, agency, careers page, direct sourcing, internal applicant, university/event and other. `Candidate.SourceOptionId` is a nullable `Restrict` FK plus a free-text `SourceDetail` (≤300) for the specific agency, campaign or board. Both are optional, and rows predating the feature keep `NULL` — so source reporting should treat "unset" as its own bucket rather than assume completeness. Note the older `Candidate.IsReferred` + reference fields overlap with the "Employee referral" source; both are kept for now rather than forcing a data migration.

**`RoleAppliedOption` doubles as a job opening.** An active role *is* an open position, and it carries optional posting metadata surfaced in the dashboard's "Active Job Openings" table (migration `AddJobOpeningFieldsToRoleAppliedOption`):

| Field | Type | Notes |
|---|---|---|
| Location | varchar(100) | nullable; one of Remote / Office / Hybrid / Contractual (`Models/JobOpeningOptions.cs`, validated) |
| Department | varchar(100) | nullable; one of Engineering / Admin / HR (validated) |
| Priority | varchar(20) | nullable; High / Medium / Low |
| EndDate | datetime | **required** closing deadline (migration `RoleOptionEndDate`; existing rows backfilled to `CreatedAt + 30 days`). After it passes, the role's candidates are **locked** from profile edits + status changes until an Admin extends it |

Assigned **recruiters** are now a **many-to-many** via **`RoleRecruiter`** (`{ RoleAppliedOptionId, UserId }`, composite PK; cascade from both parents), replacing the old single `RecruiterUserId` FK (migration `RoleRecruitersManyToMany`, which copies existing assignments into the join). Every recruiter assigned to a role can access all candidates under it (see [auth.md](auth.md)).

`CreatedAt` is the (non-editable) **posted date**; the API also returns a computed **`Title`** (`"{Name} — {posted date}"`). Applicants per opening are **derived by role** (candidates whose `RoleAppliedOptionId` matches), not a stored count. There is no separate `JobOpening` table. **Delete is SuperAdmin-only** — a role with assigned candidates is soft-disabled (returns the candidate count) rather than removed.

### CandidateSkill (`CandidateSkills`)
Many-to-many join between `Candidate` and `SkillOption`. Composite PK `(CandidateId, SkillOptionId)`; cascade-delete from Candidate, restrict on SkillOption. Candidate forms select skills from active `SkillOptions` only (not creatable from the candidate form).

### Interview (`Interviews`)
Created when a candidate moves to **Interview Scheduled** (see `CandidateService.AddStatusAsync`). One per scheduling event.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| CandidateId | int FK → Candidate | cascade delete |
| StatusHistoryId | int? FK → StatusHistory | the "Interview Scheduled" entry; SetNull |
| ScheduledAt | datetime | mirrors the history entry's InterviewAt |
| CreatedByUserId | int? FK → User | who scheduled it; SetNull |
| CreatedAt | datetime | UTC |

### InterviewInterviewer (`InterviewInterviewers`)
Join assigning users as interviewers. Composite PK `(InterviewId, UserId)`; cascade from Interview, restrict on User. Assignment grants that user read access to the interview + candidate snapshot and the right to submit one evaluation.

### InterviewTypeOption (`InterviewTypeOptions`) & InterviewTag (`InterviewTags`)
Admin-managed lookup of interview type tags (Technical, HR, Managerial, 1st Level, 2nd Level, Final Round — seeded), managed on the Configuration page like Skills. `InterviewTypeOption`: `Id`, `Name` (unique, ≤200), `SortOrder`, `IsActive`, `CreatedAt`, `UpdatedAt` (migration `AddInterviewTypeOptions`). `InterviewTag` is the many-to-many join between `Interview` and `InterviewTypeOption` (composite PK `(InterviewId, InterviewTypeOptionId)`; cascade from Interview, restrict on the type option) — mirrors `CandidateSkill`. Tags are set on the schedule form and surfaced (by name) in `StatusHistoryDto.InterviewTags` and `InterviewDetailDto.InterviewTags`.

### InterviewEvaluation (`InterviewEvaluations`)
One interviewer's evaluation of one interview. Unique index `(InterviewId, InterviewerUserId)`; cascade from Interview, restrict on the interviewer User. **Draft until `IsSubmitted`; then locked** (API rejects further writes).

| Field | Type | Notes |
|---|---|---|
| Id | int PK | |
| InterviewId | int FK → Interview | cascade delete |
| InterviewerUserId | int FK → User | restrict |
| GeneralAssessment | text | nullable |
| Recommendation | varchar(20) | Recommended/Hold/Reject/Other |
| RecommendationOther | varchar(1000) | nullable; required (server-validated) when Recommendation = Other |
| OverallRating | int | 1–5, nullable |
| IsSubmitted / SubmittedAt | bool / datetime? | submit lock |
| CreatedAt / UpdatedAt | datetime | UTC |

### InterviewEvaluationItem (`InterviewEvaluationItems`)
Per-criterion score within an evaluation. Unique `(InterviewEvaluationId, CriterionKey)`; cascade from evaluation. `CriterionKey` is validated dynamically against the candidate's assigned role rubric (or the default system rubric); `Rating` 1–5 nullable; `Comment` varchar(1000) nullable. Empty items (no rating + no comment) are not persisted.

### EvaluationRubric (`EvaluationRubrics`) & RubricCriterion (`RubricCriteria`)
Scorecard template definitions that can be customized per Job Opening (`RoleAppliedOption.EvaluationRubricId`).
- `EvaluationRubric`: `Id`, `Name` (unique, ≤200), `Description` (≤1000), `IsDefault`, `IsActive`, `CreatedAt`, `UpdatedAt`.
- `RubricCriterion`: `Id`, `EvaluationRubricId` (FK, cascade), `SectionName` (≤100), `Key` (unique per rubric, ≤100), `Label` (≤200), `Hint` (≤500), `Weight` (double, default 1.0), `SortOrder`.
- Seed data ensures the default 12-criterion standard rubric exists (`Id = 1`, `IsDefault = true`).

### Offer (`Offers`)
Candidate job offer details, structured compensation package, and lifecycle status (`Draft`, `PendingApproval`, `Approved`, `Extended`, `Accepted`, `Declined`, `Withdrawn`).

| Field | Type | Notes |
|---|---|---|
| Id | int PK | auto |
| CandidateId | int FK → Candidate | cascade delete |
| JobTitle | varchar(200) | required |
| BaseSalary | decimal(18,2) | required; annual base compensation |
| Currency | varchar(10) | required; e.g. "USD", "EUR", "GBP" |
| Bonus | decimal(18,2) | nullable; signing or annual bonus |
| Equity | varchar(200) | nullable; stock options / RSUs |
| StartDate | datetime | nullable |
| ExpirationDate | datetime | nullable |
| Notes | varchar(2000) | nullable; terms and conditions |
| Status | varchar(50) | required; Draft / PendingApproval / Approved / Extended / Accepted / Declined / Withdrawn |
| CreatedByUserId | int FK → User | restrict |
| CreatedAt / UpdatedAt | datetime | UTC |
| ExtendedAt / RespondedAt | datetime? | UTC timestamps |
| DeclineReason | varchar(1000) | nullable; reason when status = Declined |

### OfferApproval (`OfferApprovals`)
Internal sign-off workflow for offers before candidate extension.

| Field | Type | Notes |
|---|---|---|
| Id | int PK | auto |
| OfferId | int FK → Offer | cascade delete |
| ApproverUserId | int FK → User | restrict |
| Status | varchar(50) | "Pending", "Approved", "Rejected" |
| Comment | varchar(1000) | nullable |
| ReviewedAt | datetime? | UTC |
| CreatedAt | datetime | UTC |

### Notification (`Notifications`)
Per-user in-app notification (e.g. interview assignment, offer approval request). `Id`, `UserId` (FK → User, cascade), `Title` varchar(200), `Message` varchar(500), `LinkUrl` varchar(300)? (client route), `IsRead` bool (index `(UserId, IsRead)`), `CreatedAt`. In-app and transactional email dispatched via `NotificationService`.

## Key design rules
- **Status choices come from `StatusOptions`** and valid next steps come from `StatusTransitions`. Keep `Candidate.CurrentStatus` and `StatusHistory.Status` as strings for readable history and low-risk future edits. Seed includes `Uploaded → Call for Interview`.
- **Role/Skill values come from `RoleAppliedOptions`/`SkillOptions`** (configurable). Deleting a config value that's in use **soft-disables** it (IsActive=false) instead of hard-deleting. The legacy free-text `Candidate.AppliedRole`/`Candidate.Skills` columns are retained for back-compat but the UI uses the configured values.
- **CurrentStatus is denormalized** — whenever you append a `StatusHistory`, update `Candidate.CurrentStatus` and `UpdatedAt` in the same save (see `CandidateService.AddStatusAsync`).
- **Prerequisites are enforced by the API** for status changes: task/comment for Technical Assessment, submission link for Submission Received, interview date/time for Interview Scheduled, comment **and ≥1 submitted interviewer evaluation** for Interview Completed, comment for Reject/Discontinued, and required prior statuses for Code Review/Recommended.
- **Cascade deletes** are configured for CVFiles and StatusHistories. Deleting a candidate also removes its physical CV files from disk (`CandidateService.DeleteAsync`).
- **Schema changes go through EF migrations** — never hand-edit the DB. See [backend.md](backend.md) and [feature-playbook.md](feature-playbook.md).
- **The dashboard adds no tables.** `GET /api/dashboard` is a read-only aggregation over existing entities (Candidates, StatusHistories, RoleAppliedOptions, CandidateSkills), owner-scoped like the candidate list. See [backend.md](backend.md) / [frontend.md](frontend.md).
- **Interview access is by assignment, not ownership.** An `Interview` (and the candidate snapshot shown with it) is readable by its assigned interviewers **or** Admin+, deliberately bypassing recruiter owner-scoping. An evaluation is visible to its author and Admin+ only; it locks on submit. See the spec [specs/interview-assignment-and-evaluation.md](specs/interview-assignment-and-evaluation.md).
