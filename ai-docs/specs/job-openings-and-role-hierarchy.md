# Spec — Job Openings Revamp, Role Hierarchy & Dashboard Hero

**Status:** Implemented
**Author:** AI agent
**Date:** 2026-07-10

> **Revision (2026-07-13):** the role **Recruiter** field is no longer just metadata — it now grants
> **candidate access**. It became a **many-to-many** (`RoleRecruiter` join, migration
> `RoleRecruitersManyToMany`; multi-select in Configuration), and every assigned recruiter can
> view/edit/change-status/CV **all candidates under that role** (creator-agnostic;
> `CandidateService.ApplyAccess` = owned OR assigned-role). The candidate form's role dropdown is
> scoped to a recruiter's assigned roles (auto-selected when one), the dashboard gains a recruiter
> **role filter** (`/api/dashboard?roleId=`), and **candidate delete is now Admin/SuperAdmin only**.

## 1. Summary
Turns the **Roles applied / Job openings** config into a real job-posting manager (renamed/derived
fields, a required **End Date & time** that locks candidate editing after it passes, dropdown
Location/Department, SuperAdmin-only delete), makes the role model a strict hierarchy
**SuperAdmin → Admin → Recruiter → Interviewer** (the former `Viewer`, narrowed to *dashboard +
assigned interviews only*), gates menus by access, and adds a **dashboard hero kicker** with a
welcome message + smart pending-task chips.

## 2. Motivation
Job openings had loose, optional metadata and no lifecycle; there was no way to stop changes on a
candidate whose opening had closed. The bottom role was a read-only "Viewer" that could still see
every candidate — teams wanted a true interviewer persona limited to their assignments.

## 3. Scope
**In scope:** role field rename/derivation (Role Name, auto Title, read-only Posted = CreatedAt,
required End Date, Location/Department dropdowns); end-date lock on profile edits + status changes;
SuperAdmin-only role delete with in-use warning; Viewer→Interviewer rename + access narrowing +
menu gating; dashboard hero.
**Out of scope:** per-opening headcount/pipeline, notifying candidates, scheduled auto-close jobs,
granular per-menu permissions beyond the four-role hierarchy.

## 4. Data model
- `RoleAppliedOption`: `PostedDate` → **`EndDate`** (required). `CreatedAt` is the posted date;
  `Title` is computed (`"{Name} — {CreatedAt:dd MMM yyyy}"`, not stored). Location/Department
  validated against the admin-managed `JobOpeningOption` lists (originally fixed in `Models/JobOpeningOptions.cs`) (Remote/Office/Hybrid/Contractual;
  Engineering/Admin/HR). Migration **`RoleOptionEndDate`** (existing rows → `CreatedAt + 30 days`).
- `UserRole.Role` string `Viewer` → **`Interviewer`** via data migration
  **`RenameViewerRoleToInterviewer`**.
- `CandidateDetailDto` gains `RoleEndDate` + `RoleClosed`. Full detail in
  [../data-model.md](../data-model.md).

## 5. Backend design
- `ConfigurationService`: validates role fields; `Create/UpdateRoleAsync` return an error string;
  `DeleteRoleAsync` → `(Found, Deleted, Deactivated, CandidateCount)`. `DELETE /api/config/roles/{id}`
  is `[Authorize(Roles = SuperAdmin)]`.
- `CandidateService`: `RoleLockError`/`GetRoleLockErrorAsync` + a check in `ValidateStatusChangeAsync`
  block edits/status once `EndDate` has passed (applies to all roles; Admin extends End Date to
  unlock). `Roles.cs` `Viewer`→`Interviewer`; candidate list/detail/roles GETs gated by
  `CanWriteCandidate`; dashboard owner-scope drops the old Viewer "see-all" case. See
  [../backend.md](../backend.md) / [../auth.md](../auth.md).

## 6. Frontend design
- `ConfigurationPage`: Role Name label, auto Title preview, read-only Posted date, required
  `datetime-local` End date, Location/Department `Form.Select`s, Closed marker, SuperAdmin-only
  delete confirm modal + result toast.
- `CandidateDetailPage`: `roleClosed` → warning banner + disabled profile editor and hidden
  add-status form.
- Roles/menu: `Role` type + `ALL_ROLES` + `UsersPage` renamed; `AuthContext.isInterviewerOnly`;
  Candidates/Upload menu + routes gated to `SuperAdmin/Admin/Recruiter`.
- `components/dashboard/DashboardHero`: greeting + chips from existing queries; interviewer-only
  dashboard shows hero + `MyInterviewsCard` only. See [../frontend.md](../frontend.md).

## 7. Security & auth
- Delete role = SuperAdmin only. Interviewer cannot reach candidate list/detail/roles endpoints
  (server-gated), only dashboard + their assigned interviews/notifications/evaluations (the latter
  already assignment-scoped). End-date lock is enforced server-side, not just in the UI.

## 8. Acceptance criteria
- [x] Migrations apply; no `Viewer` rows remain; existing roles get `EndDate = CreatedAt + 30d`.
- [x] Config: Role Name label, auto Title, read-only Posted, required End Date, Location/Department
      dropdowns (invalid → 400).
- [x] Past End Date → that role's candidates: profile save + status change → 400 lock error; UI
      banner + disabled forms; extending End Date unlocks.
- [x] Role delete hidden for non-SuperAdmin (DELETE → 403); with candidates → deactivated + count;
      unused → deleted.
- [x] Interviewer: menu = Dashboard only; /candidates blocked; assigned interview + evaluation work.
- [x] Dashboard hero shows greeting + pending-task chips; `tsc`/`oxlint`/`build` + `dotnet build`
      clean.

## 9. Open questions
- None. Future: scheduled auto-close notifications, per-opening pipeline metrics.
