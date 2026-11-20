<!-- phase: DONE | branch: fix/RG-262/Experience-description-bullets | tasks: 5/5
     base: d63670d | updated: 2026-11-17
     next: none -->
# Plan: Experience descriptions keep bullets (#262)
## Tasks
- [x] Failing Vitest first: 3 bullet lines render 3 list items; plain text keeps line breaks; long title has a title attribute
- [x] Add a small description renderer (bullets to <ul>, other lines to <p>), use it in ReadOnlyCandidateProfile; fix class mismatch
- [x] Job title: wrap/tooltip instead of silent truncation
- [x] Skills split: strip leading "Label:" before the chip (test: "Languages: C#, Java")
- [x] Check education entries and summary for the same issue; fix if affected
- [x] Server join DEFERRED to backlog until PR #302 merges (conflict in CVParserService.cs)
## Tests
- Standard tier: Vitest per item above, xUnit for the server join; full dotnet + vitest, tsc, oxlint; Playwright screenshot of the card.
## Files
- client/src/components/ReadOnlyCandidateProfile.tsx (+test), client/src/index.css, ai-docs/frontend.md
- server Services/CVParserService.cs + CVParserServiceTests.cs (if approved), ai-docs/backend.md
