# Chapter 3: Admin guide

*You keep the system running for everyone else. An Admin can do everything a Recruiter can, on
**all** candidates, plus approve offers, maintain configuration, delete candidates, review the
audit trail and import candidates from JSON.*

## 3.1 What Admin adds

| Capability | Notes |
|---|---|
| See and manage **all** candidates | no ownership or assignment limits |
| **Approve or reject offers** | on offers a recruiter sent for approval |
| See evaluation cards in the **Status history** | recruiters see them in the Evaluation report |
| **Delete** a candidate | permanent: removes the profile, history and CV files |
| **Configuration** | rubrics, skills, sources, interview types, job openings |
| **Audit** | the who-changed-what-when log |
| **JSON + CVs** import on Upload CVs | import candidates from a filled-in JSON template plus their CVs |

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

## 3.6 Importing candidates from JSON

When you already have candidate details in structured form (an export from another system, a
spreadsheet, or an AI assistant's summary of each CV), you can import them instead of relying on
CV parsing. Every candidate still needs their CV, and every import still lands in the Review
Staging Workspace for approval.

1. Open **Upload CVs** and choose **JSON + CVs** (only Admin and Super Admin see this switch;
   a Recruiter only ever sees the CV uploader).
2. Select **Download JSON template**. The comments at the top of the file are the instructions:
   the mandatory fields (**cvFileName**, **fullName**, **email**), the optional ones, and the job
   opening and source names you can use. They are current on the day you download the file.
3. Fill in one entry per candidate, by hand or by giving the template and the CVs to an AI
   assistant. The comments are written so an assistant can follow them; the importer ignores
   them, so it does not matter whether they are kept.
4. Set **cvFileName** to each CV's exact file name, for example `jane_doe.pdf`.
5. Optionally enter a **Batch label**, and pick a default **Job opening** — this is required,
   same as for a plain CV upload. An entry that names its own role falls back to this default,
   with a note in the pre-check table, if that role doesn't match an open opening.
6. Drop the JSON file together with all the CVs onto the drop area.

The pre-check table shows every entry before anything is saved:

- **Ready**: the entry will be imported.
- **Ready, check notes**: it will be imported, but something needs attention in review, such as
  a source name that does not match (that field is left blank for you to pick), a role that fell
  back to the batch's job opening, or an email that already belongs to a candidate.
- **Will be skipped**: something is wrong, such as a missing mandatory field, an invalid email, or
  no CV with that file name. The reason is shown on the row.

Select **Import N candidates**. Each entry becomes a **Pending** draft with its CV attached, filled
in from the JSON. Then select **Open Review Workspace** and approve the drafts as in
[2.3](#23-adding-candidates-upload-cvs). A CV the system already holds is marked **Duplicate** and
not imported.
