# Chapter 4: Super Admin guide

*You own the accounts. A Super Admin can do everything an Admin can, plus manage users, email
settings, deleting job openings and importing candidates from JSON.*

## 4.1 What Super Admin adds

| Capability | Notes |
|---|---|
| **Users** page | add users, set roles, activate or deactivate, reset passwords |
| **Email** tab in Configuration | the mail server used for invites and account emails |
| **Delete** a job opening | Admins can only edit or deactivate openings |
| **JSON + CVs** import on Upload CVs | import candidates from a filled-in JSON template plus their CVs |

## 4.2 Managing users

**Users** lists every account with name, email, roles, status, last login, and whether they must
change their password.

**Add user** and provide:

- **Name** and **Email**. The email is the sign-in and must be unique.
- **Roles:** one or more of Super Admin, Admin, Recruiter, Interviewer.
- **Temporary password** (at least 8 characters). The user gets an email and must set their own
  password at first sign-in (see [0.2](#02-first-login-set-your-own-password)).

![Add user](images/04-add-user.png)

**Choosing the right role:**

- Only conducts interviews: **Interviewer**.
- Sources and manages candidates: **Recruiter**, then have an Admin assign them to job openings,
  or they will only see candidates they create themselves.
- Maintains configuration, approves offers or needs to see everything: **Admin**.
- Keep **Super Admin** to the smallest possible group.

**Edit** changes a user's name, roles and Active flag. **Deactivate** stops the account from
signing in and from being assigned to interviews; its history is kept. There is no delete.
**Reset password** sets a new temporary password; the user is emailed and must change it at next
sign-in.

> **Guard rail:** the system refuses to deactivate, or remove the role from, the **last active
> Super Admin**, so you cannot lock everyone out.

## 4.3 Email settings

The **Email** tab (Super Admin only) holds the mail server settings: host, port, STARTTLS,
username, password, sender address and name, plus **Email Delivery** on or off and a test send.
The app emails **users** only (interview invites, new accounts, password resets and changes),
never candidates.

## 4.4 Importing candidates from JSON

When you already have candidate details in structured form (an export from another system, a
spreadsheet, or an AI assistant's summary of each CV), you can import them instead of relying on
CV parsing. Every candidate still needs their CV, and every import still lands in the Review
Staging Workspace for approval.

1. Open **Upload CVs** and choose **JSON + CVs** (only Super Admins see this switch).
2. Select **Download JSON template**. The comments at the top of the file are the instructions:
   the mandatory fields (**cvFileName**, **fullName**, **email**), the optional ones, and the job
   opening and source names you can use. They are current on the day you download the file.
3. Fill in one entry per candidate, by hand or by giving the template and the CVs to an AI
   assistant. The comments are written so an assistant can follow them; the importer ignores
   them, so it does not matter whether they are kept.
4. Set **cvFileName** to each CV's exact file name, for example `jane_doe.pdf`.
5. Optionally enter a **Batch label** and a default **Job opening** for entries that name no role.
6. Drop the JSON file together with all the CVs onto the drop area.

The pre-check table shows every entry before anything is saved:

- **Ready**: the entry will be imported.
- **Ready, check notes**: it will be imported, but something needs attention in review, such as
  a role or source name that does not match (that field is left blank for you to pick) or an
  email that already belongs to a candidate.
- **Will be skipped**: something is wrong, such as a missing mandatory field, an invalid email, or
  no CV with that file name. The reason is shown on the row.

Select **Import N candidates**. Each entry becomes a **Pending** draft with its CV attached, filled
in from the JSON. Then select **Open Review Workspace** and approve the drafts as in
[2.3](#23-adding-candidates-upload-cvs). A CV the system already holds is marked **Duplicate** and
not imported.

## 4.5 Deleting job openings

Only Super Admins can delete an opening in Configuration. If candidates were ever filed under it,
the opening is deactivated instead and the app shows how many candidates block deletion.

## 4.6 Good habits

- Check **Audit** now and then for bursts of `Auth.LoginFailed` and unexpected user or role
  changes.
- Deactivate accounts of people who leave. The **Last login** column shows inactive accounts.
- Keep each opening's **recruiters** and **Closes** date current: they control access and
  locking.
