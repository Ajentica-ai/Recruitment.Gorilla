# Discarded CVs should be deletable from the Upload CVs page
- Source: issue #55 https://github.com/Ajentica-ai/Recruitment.Gorilla/issues/55 (labels: bug, Improvements)
- Type: bug (per tracker label; reads as a missing feature)
## Request
- Review Staging Workspace > Discarded tab: a discarded CV draft can only be viewed. The user wants to delete/remove it for good.
- Discard today only sets Status=Discarded; there is no delete endpoint or button for drafts.
## Decisions
- Ticket meaning (user): discarded CVs on Upload CVs must be deletable/removable
- Proposed, confirm via plan: permanent delete (row + stored CV file), Discarded drafts only, confirm dialog
- Proposed: single Delete in the editor footer + bulk Delete Selected on the Discarded tab
- Proposed: same scope as discard (Admin+ any draft, Recruiter own uploads); Interviewer 403
## Out of scope
- Deleting Pending or Approved drafts; restore/undo; auto-purge of old discarded drafts
## Follow-ups
- DiscardDraftAsync has no status guard (API can discard an Approved draft)