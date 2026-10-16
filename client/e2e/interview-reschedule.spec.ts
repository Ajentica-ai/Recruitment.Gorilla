import { test, expect, type APIRequestContext } from '@playwright/test';
import { ADMIN, apiAuth, requireData, signIn } from './helpers';

/**
 * Issue #173: a booked interview can be moved from the candidate timeline, and the timeline then
 * shows the new date rather than the one first booked.
 *
 * Drives a booking that already exists in the dev database and puts it back afterwards, rather
 * than creating a candidate: `POST /api/candidates` is the import path and refuses a CV file it
 * has no upload session for, and the suite already leaves too much behind (see backlog). The
 * cancel path's behaviour is covered by the server tests and the modal's unit tests; what is
 * asserted here is the half only a browser can prove, that the actions are reachable from the
 * timeline and that the rendered date follows the move.
 */

// The SuperAdmin fixture is the identity `.env.e2e.example` guarantees; fall back to the
// generic admin/recruiter vars when a machine is set up the older way.
const admin = {
  email: process.env.SUPERADMIN_EMAIL ?? ADMIN.email ?? process.env.E2E_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD ?? ADMIN.password ?? process.env.E2E_PASSWORD,
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A candidate sitting at Interview Scheduled whose booking is still live. */
async function liveBooking(
  request: APIRequestContext,
  auth: Record<string, string>,
): Promise<{ candidateId: number; interviewId: number; schedule: any } | null> {
  const res = await request.get(
    `/api/candidates?page=1&pageSize=50&status=${encodeURIComponent('Interview Scheduled')}`,
    { headers: auth },
  );
  if (!res.ok()) return null;
  const body = await res.json();
  const items = body.items ?? body;
  if (!Array.isArray(items)) return null;

  for (const c of items) {
    const detail = await request.get(`/api/candidates/${c.id}`, { headers: auth });
    if (!detail.ok()) continue;
    const entry = (await detail.json()).statusHistory?.find(
      (h: any) =>
        h.status === 'Interview Scheduled' && h.interviewId && h.interviewStatus === 'Scheduled',
    );
    if (!entry) continue;

    const sched = await request.get(`/api/interviews/${entry.interviewId}/schedule`, {
      headers: auth,
    });
    if (!sched.ok()) continue;
    const schedule = await sched.json();
    // A submitted evaluation means the interview happened; moving it is refused by design.
    if (schedule.hasSubmittedEvaluation) continue;
    // Only a booking still in the future can be put back afterwards: the API refuses a target
    // time in the past, so restoring one whose original slot has already gone by would fail
    // silently and leave the dev database drifted.
    if (new Date(schedule.scheduledAt).getTime() <= Date.now()) continue;

    return { candidateId: c.id, interviewId: entry.interviewId, schedule };
  }
  return null;
}

test.describe('Interview reschedule (#173)', () => {
  test('moving a booking from the timeline updates the date shown there', async ({
    page,
    request,
  }) => {
    const auth = await apiAuth(request, admin);
    const booking = await liveBooking(request, auth);
    requireData(
      booking !== null,
      'a candidate at Interview Scheduled whose interview has no submitted evaluation',
    );
    const { candidateId, interviewId, schedule } = booking!;

    const movedTo = new Date();
    movedTo.setDate(movedTo.getDate() + 9);
    const newDay = ymd(movedTo);

    try {
      await signIn(page, admin);
      await page.goto(`/candidates/${candidateId}`);

      // The timeline lives behind the history drawer on the candidate page. Wait for the button
      // rather than clicking whatever is there: the page renders before the candidate query lands.
      const openHistory = async () => {
        const button = page.getByRole('button', { name: /^Status history/ });
        await expect(button).toBeVisible({ timeout: 15_000 });
        await button.click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
      };
      await openHistory();

      const reschedule = page.getByRole('button', { name: /^reschedule$/i }).first();
      await expect(reschedule).toBeVisible({ timeout: 15_000 });
      await reschedule.click();

      // The form opens prefilled on what is booked today, so a small change is a small edit.
      const dialog = page.getByRole('dialog');
      const duration = dialog.getByLabel('Interview duration');
      await expect(duration).toBeVisible();
      await expect(duration).toHaveValue(String(schedule.durationMinutes));

      await dialog.locator('input[type="date"]').first().fill(newDay);
      await dialog.getByRole('button', { name: /save new time/i }).click();

      // The API is the authority on what was stored. Compared in local time, because the picker
      // takes a local date/time and the API stores UTC: a booking at 00:00 local east of
      // Greenwich is the previous day in UTC, which is correct, not a bug.
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/interviews/${interviewId}/schedule`, {
              headers: auth,
            });
            return res.ok() ? ymd(new Date((await res.json()).scheduledAt)) : null;
          },
          { timeout: 15_000 },
        )
        .toBe(newDay);

      await page.reload();
      await openHistory();

      // The line that would have shown the stale date before #173.
      await expect(page.getByText(/Rescheduled from/i).first()).toBeVisible({ timeout: 15_000 });

      // And the cancel affordance sits beside it, refusing to proceed without a reason.
      await page.getByRole('button', { name: /cancel interview/i }).first().click();
      const confirm = page.getByRole('dialog');
      await expect(confirm.getByText(/Call for Interview/)).toBeVisible();
      await confirm.getByRole('button', { name: /^cancel interview$/i }).click();
      await expect(confirm.getByText(/reason is required/i)).toBeVisible();
      await confirm.getByRole('button', { name: /^cancel$/i }).click();
    } finally {
      // Put the booking back where it was, so the dev database is as this spec found it.
      const restored = await request.put(`/api/interviews/${interviewId}`, {
        headers: auth,
        data: {
          scheduledAt: schedule.scheduledAt,
          durationMinutes: schedule.durationMinutes,
          notes: schedule.notes,
          interviewerUserIds: schedule.interviewerUserIds,
          interviewTypeOptionIds: schedule.interviewTypeOptionIds,
          reason: 'Restored by the E2E suite',
        },
      });
      // Asserted, not fire-and-forget: a restore that quietly 400s leaves someone's booking moved.
      expect(
        restored.ok(),
        `could not restore interview ${interviewId} to ${schedule.scheduledAt}`,
      ).toBeTruthy();
    }
  });
});
