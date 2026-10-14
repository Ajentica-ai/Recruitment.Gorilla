# "User updated." toast after clicking Cancel on Edit User
- Source: issue #39 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/39
- Type: bug
## Request
- Open Users, click Edit, change nothing, click Cancel: the app shows "User updated." and saves.
- Expected: Cancel just closes the dialog, no save, no toast.
## Decisions
- Root cause: Button renders a plain <button> with no default type, so Cancel inside the <form> is a submit button and fires submitForm -> updateUser.
- Sibling Cancel buttons inside forms share the pattern (UsersPage reset modal, EvaluationRubricsTab, JobOpeningsTab, AddStatusModal).
## Out of scope
- Changing the shared Button default type (wide blast radius).
## Follow-ups
