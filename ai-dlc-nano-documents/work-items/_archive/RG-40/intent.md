# Password visibility icon missing from Temporary Password field
- Source: issue #40 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/40
- Type: feature (labels: Improvements, UI — no Bug label)

## Request
- Add User modal's "Temporary password" field has no show/hide icon and is plain
  `<Input>` (not even `type="password"`), unlike the shared `PasswordInput`
  component already used on sign-in, change-password, and SMTP settings.
- Add the same show/hide behavior there.

## Decisions
- Sibling field found: the "Reset password" modal's "Temporary password" field
  (same file, same component) has the identical defect. Fix both for
  consistency (pending user confirmation in the fast-path message).
- Fix: swap `Input` for the existing `PasswordInput` component
  (`client/src/components/common/PasswordInput.tsx`) at both call sites.

## Out of scope
- No backend change; this is purely the input's rendering.

## Follow-ups
- none
