# Chapter 3: Admin guide

*You keep the system running for everyone else. An Admin can do everything a Recruiter can, on
**all** candidates, plus approve offers, maintain configuration, delete candidates and review the
audit trail.*

## 3.1 What Admin adds

| Capability | Notes |
|---|---|
| See and manage **all** candidates | no ownership or assignment limits |
| **Approve or reject offers** | on offers a recruiter sent for approval |
| See evaluation cards in the **Status history** | recruiters see them in the Evaluation report |
| **Delete** a candidate | permanent: removes the profile, history and CV files |
| **Configuration** | rubrics, skills, sources, interview types, job openings |
| **Audit** | the who-changed-what-when log |

## 3.2 Approving offers

An offer waiting for approval shows **Approve Offer** and **Reject** to Admins:

![Approving an offer](images/03-offer-approve.png)

In the candidate's **Status history**, Admins also see each interviewer's evaluation card
(recommendation and overall rating) under **Interview Completed**:

![Status history with evaluation cards](images/03-history-evaluation-cards.png)

## 3.3 Configuration

**Configuration** has one tab per list. Each tab has search and All, Active and Inactive
filters.

![Configuration: Evaluation rubrics](images/03-configuration.png)

| Tab | What you manage |
|---|---|
| **Evaluation rubrics** | The scorecards interviewers fill in: sections, criteria and weights. Create, edit, duplicate, set the default, or delete (the default rubric cannot be deleted). |
| **Skills** | Skill tags offered on candidate profiles and in filters. |
| **Candidate sources** | Where candidates come from (LinkedIn, Employee referral...), used in Analytics. |
| **Interview types** | Tags recruiters attach when scheduling (Technical, HR, 1st Level...). |
| **Job openings** | Each opening's name, **Closes** date (required), priority, location, department, **rubric**, **recruiters** and Active flag. |

For skills, sources and interview types, deleting an item that is already in use deactivates it
instead, so history is kept.

![Configuration: Job openings](images/03-configuration-job-openings.png)

Job openings drive access and locking, so keep them current:

- **Recruiters:** assigning a recruiter gives them every candidate under the opening.
- **Closes date:** after it passes, the opening locks: no edits, status changes or offers for its
  candidates until you extend the date.
- **Rubric:** the scorecard interviewers use for this opening (the default rubric if none).
- Deleting an opening is **Super Admin only**.

## 3.4 Deleting a candidate

On the candidate list (row menu) or the profile (**...** menu), Admins have **Delete**. After
you confirm, the candidate, their history and CV files are removed permanently. The deletion is
recorded in the audit trail.

## 3.5 The audit trail

**Audit** answers "who changed what, and when":

![Audit](images/03-audit.png)

Every change is recorded: sign-ins (including **failed** attempts), password changes, candidate
changes and status moves, evaluations, offers, configuration and user management. Each row shows
the time, the person, a colored action (for example `Offer.Created`, `Auth.LoginFailed`), the
record and a summary.

Filter by **Entity type**, **Action contains** and a **From / To** date and time, then
**Filter**. Results are newest first, 50 per page. The log cannot be edited or deleted by anyone.
