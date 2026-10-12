# EmailOutboxWorker can crash the whole API (overlapping PeriodicTimer/channel waits)
- Source: issue #139 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/139
- Type: bug
## Request
- Found while running the Playwright suite for RG-138 (unrelated): the API crashed mid-run.
- Root cause: `EmailOutboxWorker.ExecuteAsync` races `signal.WaitAsync()` against
  `timer.WaitForNextTickAsync()` via `Task.WhenAny` every loop, abandoning whichever loses
  while still pending. The next iteration starts a *new* call to the same `PeriodicTimer`
  while the old one is still outstanding; `PeriodicTimer` forbids overlapping calls and
  throws `InvalidOperationException`, uncaught, which (via
  `HostOptions.BackgroundServiceExceptionBehavior = StopHost`) takes the whole API down.
  Fires under ordinary traffic: any two emails queued within one 30s poll window.
- Same shape of bug, quieter, on the signal side (`SingleReader` channel): an abandoned
  `WaitAsync()` can silently consume a later `Notify()`, delaying that email up to 30s.
## Decisions
## Out of scope
- `AuditLogBatchWorker` / `SlackQueueWorker` use different wake patterns (a single queue
  read, not a timer/signal race) and were not found to share this bug; not touched.
## Follow-ups
