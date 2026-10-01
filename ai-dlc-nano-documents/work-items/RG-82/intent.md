# Configuration: rubric editor section header wraps inside its chip on narrow viewports
- Source: issue #82 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/82
- Type: bug (label `bug`)

## Request
Each section's header row packs "Section N", the section-name input, "Add Criterion"
and a delete button onto one non-wrapping line. Below roughly 420px the chip wraps
inside its own background and the name input truncates mid-word. Expected: the header
reflows to two rows, label and name first, actions second.

## Decisions
- Fold in the RG-85 backlog entry: the criterion description clips even at 52rem. Same
  file, same root concern, so one pass covers both rows.
- Criterion row gets rebalanced columns, label 4 / description 6 / weight 2 instead of
  5/5/2, rather than giving the description its own line. Keeps the row one line tall;
  a very long description could still clip, which is accepted.

## Measured before fixing
- Phone 390: badge 38px tall against a 19px line-height, so "Section 1" wraps inside
  its chip. Name input 125px wide against 148px of content. Header row is
  `flex-wrap: nowrap`, which is the cause.
- Desktop 1280 inside the 52rem drawer: badge fine; description input 280px against
  311px of content, so it clips there too.

## Out of scope
- Turning the description into a textarea, or any change to the criterion control type.

## Follow-ups
