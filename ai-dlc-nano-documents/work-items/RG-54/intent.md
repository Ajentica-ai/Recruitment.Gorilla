# Job opening Location / Priority / Department values need to be customizable
- Source: issue #54 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/54 (label "UI" is wrong per user; treat as feature)
- Type: feature
## Request
- Configuration > Job openings > Add/Edit: Location, Priority, Department are fixed lists (hard-coded in JobOpeningsTab.tsx and, for Location/Department, in server JobOpeningOptions). Admins should manage the values.
## Decisions
- Approach A (user): admin-managed lookup lists in Configuration, following the Skills / Candidate sources / Interview types pattern
- One lookup table with a Kind (Location|Department|Priority), reusing OptionChipsTab in one "Job opening fields" tab -> proposed, confirm via plan
- Priority fully customizable (custom levels get a neutral badge); rename updates openings using it; delete blocked while in use (deactivate instead); Admin+ only -> assumptions, confirm via plan
## Out of scope
- Reworking recruiter assignment, Dashboard/Analytics layout
## Follow-ups
- none yet
