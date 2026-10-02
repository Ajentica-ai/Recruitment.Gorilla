# Duplicate visibility icons on the Change Password form
- Source: issue #36 https://github.com/tahmidsparrow/Recruitment.Gorilla/issues/36
- Type: bug

## Request
- Once a password field has a value, two eye icons appear side by side.
- Reported on the Change Password form; the same field is used on sign-in and
  the SMTP settings tab, so the defect is not page-specific.

## Root cause
- `client/src/components/common/PasswordInput.tsx` renders its own show/hide
  button over a native `<input type="password">`.
- Chromium/Edge paint a *native* reveal control (`::-ms-reveal`) inside the same
  input as soon as it holds a value. Two controls, one field.
- Nothing in `client/src/index.css` suppresses the native control.

## Decisions
- Keep our own button (it is focusable, labelled and `aria-pressed`) and hide the
  browser's, rather than the reverse - the native one is unstyleable and absent
  in Firefox/Safari, so dropping ours would make the feature browser-dependent.
- Fix in `PasswordInput`'s own styling so all five password inputs are covered by
  one change.

## Out of scope
- Any other change to password UX, validation or the change-password flow.

## Follow-ups
- `client/src/index.css:125` and `:1105` define byte-identical `.required-star`
  rules. Not touched here - unrelated to the password field.

