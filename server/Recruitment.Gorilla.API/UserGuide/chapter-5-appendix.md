# Chapter 5: Appendix

## 5.1 Permission matrix

| Capability | Super Admin | Admin | Recruiter | Interviewer |
|---|:-:|:-:|:-:|:-:|
| Dashboard | Yes | Yes | Yes | Yes |
| Assigned interviews and evaluations | Yes | Yes | Yes | Yes |
| Analytics, Jobs | Yes | Yes | own scope | - |
| View and browse candidates | all | all | own or assigned opening | assigned interviews only |
| Upload CVs (job opening required) and create candidates | Yes | Yes | Yes (becomes owner) | - |
| Import candidates from JSON (job opening required) | Yes | Yes | - | - |
| Review and approve drafts | all | all | own uploads or assigned opening | - |
| Edit candidates, change status | all | all | own or assigned opening | - |
| Evaluation report | all | all | own or assigned opening | - |
| Draft and extend offers | Yes | Yes | own or assigned opening | - |
| Approve or reject offers | Yes | Yes | - | - |
| Delete candidate | Yes | Yes | - | - |
| Configuration | Yes | Yes | - | - |
| Delete a job opening | Yes | - | - | - |
| Audit | Yes | Yes | - | - |
| Users, Email settings | Yes | - | - | - |

## 5.2 The pipeline map

| From | Can move to |
|---|---|
| Uploaded | Ask for Assessment, Call for Interview, Not Available, Reject, Discontinued |
| Ask for Assessment | Technical Assessment, Not Available, Discontinued |
| Technical Assessment | Submission Received, No Submission, Not Available, Discontinued |
| Submission Received | Code Review |
| Code Review | Call for Interview, Not Recommended, Not Available, Discontinued |
| Call for Interview | Interview Scheduled, Not Available, Discontinued |
| Interview Scheduled | Interview Completed, Not Available, Discontinued |
| Interview Completed | Recommended, Not Recommended, Interview Scheduled (another round), Not Available, Discontinued |
| Recommended | Offer Preparation, Offer Extended, Reject, Discontinued |
| Offer Preparation | Offer Extended, Offer Declined, Reject, Discontinued |
| Offer Extended | Offer Accepted, Offer Declined, Reject, Discontinued |
| Offer Accepted | Hired, Offer Declined, Discontinued |
| Offer Declined | Offer Preparation, Reject, Discontinued |
| Not Recommended, Not Available, Hired | Discontinued |
| No Submission, Reject, Discontinued | (final, no further moves) |

Offer actions on the Offer card (draft, extend, record decision) move the candidate
automatically.

## 5.3 FAQ

**I'm a Recruiter and I can't see a candidate I know exists.**
You only see candidates you created or that belong to a job opening you are assigned to. Ask an
Admin to add you as a recruiter of that opening (Configuration > Job openings).

**The "Role applied for" list is empty when I review a draft.**
You have no assigned openings yet, or the opening has closed. Ask an Admin.

**The Upload CVs drop area won't accept files.**
Pick a **Job opening** first — it's required now, not optional, and the drop area stays locked
until you choose one. If the list is empty, you have no open openings assigned to you; ask an
Admin.

**I can't edit a candidate or change their status.**
Check for the "Job opening closed" banner. Once the opening's Closes date passes, it locks for
everyone until an Admin extends it.

**Why can't I move the candidate to Interview Completed?**
At least one assigned interviewer must **submit** (not just save a draft) their evaluation first.
Their Dashboard shows it as *Pending* or *Draft*.

**My upload says Duplicate.**
That exact file is already in the system, as a draft or on a candidate. Find the existing record
instead.

**The interviewer can't edit their evaluation.**
Submitted evaluations are locked by design. If another round is needed, schedule a new interview
from Interview Completed.

**I deleted a candidate by mistake. Can it be undone?**
No. Deletion is permanent, which is why it is Admin-only and asks for confirmation. The audit
trail still records who deleted what and when.

**Why am I stuck on Change password?**
Your account has a temporary password (new account or reset). Set your own and the app unlocks.

**Does the candidate get emails from the system?**
No. The app emails users only. Communication with candidates, including sending offers, happens
outside the app.

**Can one person be both Recruiter and Interviewer?**
Yes. Roles combine.
