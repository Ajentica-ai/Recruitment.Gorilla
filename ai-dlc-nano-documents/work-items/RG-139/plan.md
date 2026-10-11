<!-- phase: DONE | branch: fix/RG-139/Email-outbox-overlapping-wait-crash | tasks: 3/3
     base: d35c517 | updated: 2026-10-11
     next: none - complete, uncommitted; awaiting commit/push/PR on request -->
# Plan: Fix the EmailOutboxWorker crash (RG-139)
## Tasks
- [x] 1. Reproduce first: a new `BackgroundQueueTests` case that queues two emails close
      together (two `Notify()`s inside one poll window) against the *current* worker code,
      confirming the worker's task faults/throws `InvalidOperationException` (the actual bug),
      before touching the fix.
- [x] 2. Fix `EmailOutboxWorker.ExecuteAsync`: keep the `signalTask`/`timerTask` alive across
      loop iterations, replacing each only once it has actually completed (checked separately
      after `Task.WhenAny`), instead of starting a fresh overlapping call on the loser every
      time. Covers both the crashing `PeriodicTimer` side and the quieter channel-reader side.
- [x] 3. Confirm the Task 1 test now passes unmodified (red to green); add a second case
      queuing 3-4 emails in a tight burst and asserting all are delivered with no fault.
## Tests
- High blast radius tier (a background-service crash takes down the whole API): reproduce
  before fixing, full `dotnet test` run, and a manual check that the running API survives
  several emails queued back to back (the Playwright suite itself is adequate real traffic).
## Files
- `server/Recruitment.Gorilla.API/Services/Background/EmailOutboxWorker.cs`
- `server/Recruitment.Gorilla.Tests/BackgroundQueueTests.cs`
