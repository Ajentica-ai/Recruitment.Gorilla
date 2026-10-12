# Chapter 4: Super Admin guide

*You own the accounts. A Super Admin can do everything an Admin can, plus manage users, email
settings and deleting job openings.*

## 4.1 What Super Admin adds

| Capability | Notes |
|---|---|
| **Users** page | add users, set roles, activate or deactivate, reset passwords |
| **Email** tab in Configuration | the mail server used for invites and account emails |
| **Delete** a job opening | Admins can only edit or deactivate openings |

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

## 4.4 Deleting job openings

Only Super Admins can delete an opening in Configuration. If candidates were ever filed under it,
the opening is deactivated instead and the app shows how many candidates block deletion.

> Importing candidates from a JSON file (**JSON + CVs** on Upload CVs) is now also available to
> Admins, not Super Admin only — see [3.6](#36-importing-candidates-from-json).

## 4.5 Good habits

- Check **Audit** now and then for bursts of `Auth.LoginFailed` and unexpected user or role
  changes.
- Deactivate accounts of people who leave. The **Last login** column shows inactive accounts.
- Keep each opening's **recruiters** and **Closes** date current: they control access and
  locking.
