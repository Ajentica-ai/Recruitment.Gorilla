<!-- phase: DONE | branch: fix/RG-262/Join-wrapped-CV-lines | tasks: 4/4
     base: 82f9f86 | updated: 2026-11-23
     next: user reviews, then commit + push + PR (Closes #262) -->
# Plan: join hard-wrapped CV lines (server half of #262)
## Tasks
- [x] Failing xUnit test first: a bullet wrapped over 2-3 lines parses to one description line
- [x] In ParseExperienceLines, append a non-bullet line to the previous bullet when that bullet does not end in . ! ? : or ;
- [x] More tests: separate bullets stay separate, a plain paragraph after a finished bullet stays separate, non-wrapped CV unchanged
- [x] dotnet test full suite green; update ai-docs if the parser is documented
## Tests
- Standard tier. Unit tests in CVParserServiceTests via ExtractFields.
## Files
- server/Recruitment.Gorilla.API/Services/CVParserService.cs
- server/Recruitment.Gorilla.Tests/CVParserServiceTests.cs
