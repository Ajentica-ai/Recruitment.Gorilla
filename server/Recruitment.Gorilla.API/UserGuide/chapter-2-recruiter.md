# Chapter 2: Recruiter guide

*You run the pipeline: upload CVs, keep profiles accurate, move candidates from **Uploaded**
towards **Hired**, schedule interviews and prepare offers.*

## 2.1 Which candidates you can see

You can work with a candidate when **either** is true:

1. **You created them** (you are the owner), or
2. **You are an assigned recruiter of their job opening.** An Admin assigns recruiters to each
   opening in Configuration. Every candidate under that opening is then yours to manage,
   whoever created them.

This rule applies everywhere: the candidate list, profiles, CV files, status changes, offers,
Analytics and your Dashboard. You **cannot delete** candidates; ask an Admin.

The same rule covers **drafts** waiting in the Review Workspace (2.3): you see and can approve a
draft you uploaded yourself, or one anyone uploaded for a job opening you're assigned to.

## 2.2 Your dashboard

Your Dashboard adds **Candidates** and **Upload CVs** shortcuts at the top (on a phone, a floating
**Upload CVs** button at the bottom right). **Up next** gets a **Mine / Team** switch: *Team* lists
upcoming interviews across your candidates. Select a stage under **Pipeline**, or an open role,
to open those candidates:

![Recruiter dashboard](images/02-dashboard-recruiter.png)

Further down, **My pipeline** is scoped to your candidates, with a **Role** filter for one of your
job openings: **Insights** (candidates by role, or top skills), **Offers** and **Recent
activity**. Several changes in a row to the same candidate are grouped into one line; select
*N changes* to see each one.

![Recruiter dashboard: active job openings and My pipeline](images/02-dashboard-recruiter-pipeline.png)

## 2.3 Adding candidates: Upload CVs

Adding candidates has two steps: **upload** the CVs, then **review** what was extracted.

**Step 1: Upload & Intake**

1. Open **Upload CVs**.
2. Optionally enter a **Batch label** (for example "QA intake October"). Pick the
   **Job opening** the CVs are for — this is required, and the drop area stays locked until
   you choose one.
3. Drag PDF or Word (.docx) files onto the drop area, or select it to browse. Each file can be
   up to 10 MB, and you can drop many at once.

![Upload & Intake](images/02-upload-cvs.png)

Each CV is read in the background and saved as a **draft**. When it finishes, select
**Open Review Workspace**.

![Upload finished](images/02-upload-done.png)

A CV the system already holds (waiting as a draft, or attached to a candidate) is skipped and
marked **Duplicate**.

**Step 2: Review Staging Workspace**

![Review Staging Workspace](images/02-review-workspace.png)

- The left list shows your **Pending** drafts. Filter by job opening or upload batch, or search.
- The right side shows the extracted details for the selected draft. Check and correct them:
  name, email, phone, title, location, role applied for, relevant experience, sourcing channel,
  skills, summary, links, education and work history.
- **Approve & Create Candidate** creates the candidate at status **Uploaded**.
  **Save Changes** keeps your edits for later. **Discard Draft** removes it.
- Shortcuts: Ctrl+Enter approves, Ctrl+Left and Ctrl+Right move through the queue.
- Tick several drafts to **Approve Selected** or **Discard Selected** at once.
- On the **Discarded** tab, **Delete Draft** (or **Delete Selected**) removes discarded CVs for good, after
  a confirmation. This cannot be undone. Only discarded drafts can be deleted.

Required to approve: **Full name**, a valid **Email**, and a **Role applied for** that is
active, not past its end date, and (for you) one you're assigned to.

## 2.4 The candidate list

**Candidates** shows everyone you can access.

![Candidate list](images/02-candidates-list.png)

- Search by name, email or phone. Filter by status, role, batch, skills, or **Referred only**.
  **Clear filters** resets them.
- Sort by **Name**, **Status** or **Added** (newest first by default). Choose 10 to 100 rows per
  page.
- Your filters are kept in the page address, so you can bookmark or share a filtered list.

Switch to **Board** to see one column per pipeline stage:

![Board view](images/02-candidates-board.png)

**Drag a card** to another column to change its status. If the new status needs more details
(for example an interview time), the **Add status** panel opens. A move that the pipeline does
not allow is refused with a message.

## 2.5 The candidate profile

Select a candidate to open their profile:

![Candidate profile](images/02-candidate-detail.png)

- **Header:** name, current status and job opening, plus **CV File** (preview and download),
  **Status history**, **Evaluation report**, **Add status**, and the **...** menu with
  **Edit profile** (and **Delete candidate** for Admins).
- **Pipeline stepper:** Intake > Assessment > Interview > Offer > Hired.
- **Profile:** current position, LinkedIn and GitHub links, contact and sourcing details,
  skills, summary, education and work experience. Each part has its own **Edit** link.
- **Offer & Compensation:** appears once the candidate is recommended. See [2.8](#28-offers).

**Status history** opens the full timeline, newest first. Each entry shows the status, when and
who changed it, the comment and any details (task, submission link, interview time, tags and
panel). **Advance Stage** opens Add status from here.

![Status history](images/02-status-history-completed.png)

> If the job opening's **End Date** has passed, a "Job opening closed" banner appears and
> editing, status changes and offers are blocked for everyone until an Admin extends the date.

## 2.6 Moving a candidate through the pipeline

Select **Add status**, choose the **New status**, add a comment and **Save status**. Only the
statuses allowed from the current one are offered. The main path is:

**Uploaded > Ask for Assessment > Technical Assessment > Submission Received > Code Review >
Call for Interview > Interview Scheduled > Interview Completed > Recommended > Offer Preparation
> Offer Extended > Offer Accepted > Hired**

You can also go straight from **Uploaded** to **Call for Interview**. Side exits such as
**Not Available**, **Reject**, **Discontinued**, **No Submission**, **Not Recommended** and
**Offer Declined** are offered where they apply. The full map is in [5.2](#52-the-pipeline-map).

Some statuses need extra details. The form asks for them:

| Moving to... | You must provide |
|---|---|
| **Technical Assessment** | the **task details** and a comment |
| **Submission Received** | the **submission link** |
| **Interview Scheduled** | **date and time** and at least one **interviewer** |
| **Call for Interview** (from Interview Scheduled) | reached by **cancelling** the booked interview, with a reason |
| **Interview Completed** | a comment; at least one interviewer must have **submitted** their evaluation |
| **Reject**, **Discontinued**, **Offer Declined** | a comment explaining why |
| **Recommended** | the candidate must have passed **Code Review** or **Interview Completed** |
| **Hired** | the candidate must have **Offer Accepted** |

**"You are not assigned to a job opening."** Every CV is filed against a job opening, and you can
only use the openings an admin has assigned to you. When you have none, the upload area says so
instead of letting you drop files, and the same note appears on JSON import, on the candidate form
and when approving a staged CV. Ask an admin to assign you to an open opening; there is nothing
you can do from your own account.

**"Your job openings have ended."** A different case with a different fix: you *are* assigned, but
every opening you have is past its end date, and a CV can only be filed against an open one. Ask
an admin to extend the end date, or to assign you to another opening. Openings past their end date
are never offered in the dropdown, so this cannot be worked around by picking one anyway.

Admins are not restricted this way and can upload against any open opening.

## 2.7 Scheduling interviews

Choose **Interview Scheduled** in Add status and the form expands:

![Scheduling an interview](images/02-add-status-interview.png)

- **Interview date/time** (required) and **Duration** (15 to 120 minutes).
- **Interview types:** optional tags such as *Technical*, *HR*, *1st Level*.
- **Interviewers** (required, one or more): each gets a notification, an email with a calendar
  invite, and the interview on their Dashboard.
- **Notes for interviewers:** shown to the panel as "Notes from the recruiter".

**Completing an interview.** After the panel has submitted, move the candidate to
**Interview Completed**. **Evaluation report** then shows every submitted evaluation, the average
overall rating, the recommendations and the average per criterion. Use **Print** or
**Open as a page** to share it.

![Evaluation report](images/02-evaluation-report.png)

**Moving or cancelling a booked interview.** Open **Status history** on the candidate. The
**Interview Scheduled** entry carries two buttons while the interview is still live:

- **Reschedule** opens the booking as it stands now, so you only change what moved. You can edit
  the date and time, the duration, the interview types, the panel and the notes, and add an
  optional reason that goes into the email. The candidate's status does **not** change: moving a
  booking is not progress through the pipeline. Everyone affected is emailed an updated calendar
  invite, people added to the panel get the usual assignment message, and anyone removed is told
  they are off it. The timeline then shows the new date with a quiet "Rescheduled from ..." line
  beneath it.
- **Cancel interview** asks for a reason, tells the panel, and returns the candidate to
  **Call for Interview** so you can book a fresh one from there. The cancelled interview stays in
  the history, struck through, with the reason.

Two things to know. **Removing an interviewer who has started writing an evaluation deletes their
draft** (the dialog warns you first). And once **anyone has submitted** an evaluation, the
interview counts as having happened, so neither button works any more; use **Another round** below
instead.

One caveat on cancellations: the email is the reliable part. Because invites are sent as
publications rather than meeting requests, Gmail and Outlook do not always remove the event from
people's calendars on their own, so the panel may still need to delete it by hand.

**Sharing earlier rounds with the next panel.** When the candidate already has an earlier interview
with a submitted evaluation, the booking form (and the reschedule form) show a tick box,
**Share earlier rounds' evaluations with this panel**. It is off by default, so the new panel is not
influenced by earlier verdicts unless you choose. Tick it and everyone on the panel can read the
earlier rounds' submitted evaluations from their dashboard, the notification or the interview page,
with no separate share step. It follows the panel: someone you add gets access, someone you remove
loses it, unticking it removes it for everyone, and cancelling the interview removes it. Anything you
shared by hand yourself is never changed by this. People who already see everything (Admins and the
candidate's own recruiters) are not affected. The panel still cannot read the interview they are about
to evaluate until they submit their own.

**Another round?** From **Interview Completed** you can schedule again. The new interview gets
its own panel and evaluations, and the history keeps both rounds. This is a *second interview after
the first one finished*, which is a different thing from moving a booking that has not happened
yet.

When the last interviewer on a round submits their evaluation, the person who booked the interview and the
recruiters who can see the candidate get an **All evaluations in** notification linking to the evaluation report.
That is the cue to move the candidate to **Interview Completed**.

## 2.8 Offers

Once a candidate is **Recommended**, the **Offer & Compensation** card lets you prepare an offer.

1. Select **Draft Offer** and fill in the job title, **annual base salary**, currency, and
   optionally bonus, equity, start date, expiry date and notes. **Create Offer**.
   The candidate moves to **Offer Preparation**.

   ![Drafting an offer](images/02-offer-draft-form.png)

   The form checks the terms before it saves: the salary must be above zero, a bonus cannot be
   negative, the currency is a 3-letter code, the expiry date cannot be in the past or before the
   start date, and job title, equity and notes have length limits (200, 200 and 2,000 characters).

2. **Request Approval** sends it to an Admin, who approves or rejects it (a rejected offer goes
   back to draft). Approval is optional: you can also **Extend Offer** straight from a draft.

   ![Offer waiting for approval](images/02-offer-pending.png)

   Once an offer is waiting for approval, approved or sent, its terms are locked: you can only
   edit a **draft**. A **rejected** offer comes back as a draft with the Admin's comment. After a
   rejection, approval is no longer optional for that candidate: neither the rejected draft nor a
   **New Version** can be extended until you request approval and an Admin approves it. Offers
   follow the same rules as a status change: they stop once the job opening has ended, and you can
   only start one for a candidate who is **Recommended**, in **Offer Preparation**, or who has
   **Offer Declined**. A candidate has one offer at a time, so the next one can start only after
   the candidate has declined the last.

3. **Extend Offer to Candidate** moves the candidate to **Offer Extended**. Send the offer
   itself outside the app (use **Download PDF**).
4. **Record Candidate Decision:** **Accepted** moves the candidate to **Offer Accepted**;
   **Declined** (with a reason) moves them to **Offer Declined**.
5. Finally, use **Add status** > **Hired**.

**New Version** appears once the candidate has declined an offer and starts a revised one. The app
never emails candidates; all candidate communication happens outside it.

## 2.9 Jobs and Analytics

**Jobs** gives an overview of every job opening: totals, active and closing-soon counts, each
opening's status, priority, deadline progress, rubric and assigned recruiters. Select an
opening's candidate count to see those candidates. Openings are created and edited by Admins in
Configuration.

![Jobs](images/02-jobs.png)

**Analytics** shows average time to hire, pipeline velocity, funnel conversion, stage dwell time
(stages over 7 days are flagged), sourcing channel performance and recruiter workload. Choose a
period (7 days to All time) and a job opening. As a Recruiter you see figures for your own
candidates only. **Print Report** prints the page.

![Analytics](images/02-analytics.png)

## 2.10 Sharing evaluations

Sometimes someone who is not a recruiter on a candidate needs to read what the interviewers wrote,
for example the next round's panel. You can share a candidate's **submitted** evaluations with a
named person. Drafts are never shared, and the person sees only what you share, nothing else about
how the candidate is handled.

**To share**

1. Open the candidate and select **Share evaluations**, next to **Evaluation report**. The same
   button is on the Evaluation report itself, with a line saying how many people already have it.
2. Under **People**, search and pick one or more people. Anyone who can already read everything
   (Admins, and the candidate's own recruiters) is greyed out as **Already has access**.
3. Under **What to share**, choose **All rounds** (this includes rounds booked later) or
   **Specific interviews** and tick the rounds you mean. Each round shows its date, type and panel.
4. Optionally set an **Expires** date, after which access ends, and a **Note**. The note goes to
   each person in their notification.
5. Select **Share**. The people are notified. If someone was skipped, or something was refused,
   the message says why.

**To review or stop sharing.** The same drawer lists **Currently shared**: who, which rounds, who
shared it, when it expires and whether it is active. Select **Revoke** and confirm, and the person
loses access on their next request. Revoked and expired shares are folded away under **Show
revoked and expired**. Sharing again with someone who already has an active share updates it
instead of adding a second one, and leaving the expiry or note empty keeps what is there.

Sharing is available to Recruiters for their own candidates and to Admins for any candidate.
Interviewers cannot share.

