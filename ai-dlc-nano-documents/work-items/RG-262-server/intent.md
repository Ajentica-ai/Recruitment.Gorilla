# Join hard-wrapped CV lines in the parser (server half of #262)
- Source: issue #262 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/262 (OPEN, assigned rayhan-ajentica)
- Type: bug
## Request
- Frontend half merged in #305 as "Part of #262".
- Still open: `CVParserService.ParseExperienceLines` appends each physical PDF line separately, so one wrapped bullet becomes 2-3 lines.
- Join continuation lines onto the previous bullet. xUnit test: a wrapped bullet is joined into one line.
## Decisions
- Plan approved, branch off origin/develop, join capitalised continuations too -> user: go with recommendation
## Out of scope
- Items 3 and 4 of the issue (title tooltip, skill label stripping) are already on develop.
## Follow-ups
- none
