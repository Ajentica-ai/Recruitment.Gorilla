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

Your Dashboard adds **Candidates** and **Upload CVs** shortcuts at the top:

![Recruiter dashboard](images/02-dashboard-recruiter.png)

Further down, **My pipeline** is scoped to your candidates, with a **Role** filter for one of your
job openings: candidates by role, top skills, offer metrics, upcoming interviews and recent
activity.

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
| **Interview Completed** | a comment; at least one interviewer must have **submitted** their evaluation |
| **Reject**, **Discontinued**, **Offer Declined** | a comment explaining why |
| **Recommended** | the candidate must have passed **Code Review** or **Interview Completed** |
| **Hired** | the candidate must have **Offer Accepted** |

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

**Another round?** From **Interview Completed** you can schedule again. The new interview gets
its own panel and evaluations, and the history keeps both rounds.

## 2.8 Offers

Once a candidate is **Recommended**, the **Offer & Compensation** card lets you prepare an offer.

1. Select **Draft Offer** and fill in the job title, **annual base salary**, currency, and
   optionally bonus, equity, start date, expiry date and notes. **Create Offer**.
   The candidate moves to **Offer Preparation**.

   ![Drafting an offer](images/02-offer-draft-form.png)

2. **Request Approval** sends it to an Admin, who approves or rejects it (a rejected offer goes
   back to draft). Approval is optional: you can also **Extend Offer** straight from a draft.

   ![Offer waiting for approval](images/02-offer-pending.png)

3. **Extend Offer to Candidate** moves the candidate to **Offer Extended**. Send the offer
   itself outside the app (use **Download PDF**).
4. **Record Candidate Decision:** **Accepted** moves the candidate to **Offer Accepted**;
   **Declined** (with a reason) moves them to **Offer Declined**.
5. Finally, use **Add status** > **Hired**.

**New Version** starts a revised offer. The app never emails candidates; all candidate
communication happens outside it.

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
