# Evaluation draft can become unsavable: stale criterion keys, client/server rubric fallbacks differ, error message hidden
- Source: issue #191 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/191 (related: #188 / PR #215 unifies the resolver)
- Type: bug (UI + small server guard)
## Request
- An interviewer's draft can get stuck: every Save draft and Submit fails with a generic "Could not save the evaluation." toast and nothing on screen can fix it.
- Three compounding causes: (1) EvaluationForm sends every key in local state, including stale keys no longer in the rubric, which the server rejects as Unknown criterion; (2) the client rubric (default, then any active) and the server's validation (default, then built-in 12) can differ, and an Admin can deactivate the default rubric with no guard; (3) onError ignores response.data.message.
- Also: until the rubric query resolves the form shows the built-in sections, so a fast click can store legacy keys.
- Fix: filter the payload to the current rubric's keys; one shared resolver (done by PR #215) and refuse to deactivate the default rubric; loading state instead of fallback sections; toast the server message.
- Tests: Vitest (payload excludes unknown keys, error toast shows the server message, no form before the rubric loads); integration: deactivating the default rubric is refused.
## Decisions
- Client: payload only carries keys of the rubric on screen; loading state while the rubric loads; 404 (no rubric at all) keeps the built-in form, any other failure shows an error panel with Retry; toast shows the server message (user: go with recommendation)
- Server: refuse to deactivate the default rubric AND refuse to un-mark it as default (both leave no usable default); rubric editor UI unchanged, the server message shows through its existing error toast
- The server resolver unification is left to PR #215 (#188) to avoid conflicting with it
- Branch → fix/RG-191/Unsavable-evaluation-draft from origin/develop
## Out of scope
- The shared resolver itself (PR #215); snapshotting the rubric (#165).
## Follow-ups
- Rubric editor still lets an Admin tick Active off on the default rubric and only learns of the refusal from the server toast; disabling those controls for the default is a UI nicety, not done here.
- Server rubric lookups still differ until PR #215 (#188) merges its shared resolver.
