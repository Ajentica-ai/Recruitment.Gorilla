# Candidate page: work-experience descriptions lose bullets and line breaks
- Source: issue #262 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/262
- Type: bug
## Request
- ReadOnlyCandidateProfile renders class experience-card__description, but CSS defines experience-card__desc, so pre-line never applies.
- Render bullet lines as a real list, plain text as paragraphs. Same component serves the interview drawer.
- Long job titles are truncated with no tooltip; free-text skills keep category labels ("Languages: C#").
- Server: ParseExperienceLines should join hard-wrapped lines onto the previous bullet.
## Decisions
- Server wrapped-line join: do after PR #302 merges (same parser file) -> yes (user: go with recommendation)
## Out of scope
- Edit form and draft review (they use textareas and keep line breaks already).
## Follow-ups
