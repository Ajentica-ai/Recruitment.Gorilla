import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN, apiAuth, requireData, signIn } from './helpers';
import { seedCandidate } from './seed';

const admin = {
  email: process.env.SUPERADMIN_EMAIL ?? ADMIN.email ?? process.env.E2E_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD ?? ADMIN.password ?? process.env.E2E_PASSWORD,
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function scheduleFor(request: APIRequestContext, auth: Record<string, string>, id: number) {
  const response = await request.get(`/api/interviews/${id}/schedule`, { headers: auth });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function openHistory(page: Page) {
  const button = page.getByRole('button', { name: /^Status history/ });
  await expect(button).toBeVisible({ timeout: 15_000 });
  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Read-only browser coverage that is safe against the normal dev database. */
test('schedule controls are reachable and cancel requires a reason', async ({ page, request }) => {
  const auth = await apiAuth(request, admin);
  const list = await request.get('/api/candidates?page=1&pageSize=50&status=Interview%20Scheduled', {
    headers: auth,
  });
  expect(list.ok()).toBeTruthy();
  const items = (await list.json()).items ?? [];
  let booking: { candidateId: number; interviewId: number; scheduledAt: string } | undefined;

  for (const candidate of items) {
    const detail = await request.get(`/api/candidates/${candidate.id}`, { headers: auth });
    if (!detail.ok()) continue;
    const candidateDetail = await detail.json();
    if (candidateDetail.roleClosed) continue;
    const entry = candidateDetail.statusHistory?.find(
      (h: { status: string; interviewId?: number; interviewStatus?: string }) =>
        h.status === 'Interview Scheduled' && h.interviewId && h.interviewStatus === 'Scheduled',
    );
    if (!entry) continue;
    const schedule = await scheduleFor(request, auth, entry.interviewId);
    if (schedule.hasSubmittedEvaluation) continue;
    booking = { candidateId: candidate.id, interviewId: entry.interviewId, scheduledAt: schedule.scheduledAt };
    break;
  }

  requireData(booking !== undefined, 'a live scheduled interview without a submitted evaluation');
  await signIn(page, admin);
  await page.goto(`/candidates/${booking!.candidateId}`);
  await openHistory(page);

  await page.getByRole('button', { name: /^reschedule$/i }).first().click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByLabel('Interview duration')).toBeVisible();
  await edit.getByRole('button', { name: /^cancel$/i }).click();

  await page.getByRole('button', { name: /cancel interview/i }).first().click();
  const confirm = page.getByRole('dialog');
  await confirm.getByRole('button', { name: /^cancel interview$/i }).click();
  await expect(confirm.getByText(/reason is required/i)).toBeVisible();
  await confirm.getByRole('button', { name: /^cancel$/i }).click();

  const after = await scheduleFor(request, auth, booking!.interviewId);
  expect(after.status).toBe('Scheduled');
  expect(after.scheduledAt).toBe(booking!.scheduledAt);
});

/** Runs only against a dedicated throwaway database with outbound providers disabled. */
test('isolated cycle: upload, book, move, cancel, and rebook', async ({ page, request }) => {
  test.skip(process.env.E2E_ISOLATED !== '1', 'Requires the isolated E2E stack.');
  const base = new URL(process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:5173');
  expect(['localhost', '127.0.0.1'].includes(base.hostname)).toBeTruthy();
  expect(base.port).not.toBe('5173');

  const auth = await apiAuth(request, admin);
  const role = await request.post('/api/config/roles', {
    headers: auth,
    data: {
      name: `E2E Interview ${randomUUID()}`,
      sortOrder: 500,
      isActive: true,
      endDate: new Date(Date.now() + 30 * 86400_000).toISOString(),
    },
  });
  expect(role.ok(), await role.text()).toBeTruthy();

  const candidateId = await seedCandidate(request, auth, 'Interview Cycle Probe');
  const users = await request.get('/api/interviews/assignable-users', { headers: auth });
  expect(users.ok()).toBeTruthy();
  const interviewer = (await users.json()).find((u: { email: string }) => u.email === admin.email);
  expect(interviewer).toBeDefined();

  const changeStatus = async (data: Record<string, unknown>) => {
    const response = await request.post(`/api/candidates/${candidateId}/status`, { headers: auth, data });
    expect(response.ok(), `${response.status()}: ${await response.text()}`).toBeTruthy();
    return response.json();
  };

  await changeStatus({ status: 'Call for Interview', comment: 'Ready to meet' });
  const originalAt = new Date(Date.now() + 7 * 86400_000);
  const booked = await changeStatus({
    status: 'Interview Scheduled',
    interviewAt: originalAt.toISOString(),
    interviewerUserIds: [interviewer.id],
    interviewDurationMinutes: 60,
  });
  const interviewId = booked.interviewId as number;
  expect(interviewId).toBeGreaterThan(0);

  await signIn(page, admin);
  await page.goto(`/candidates/${candidateId}`);
  await openHistory(page);
  await page.getByRole('button', { name: /^reschedule$/i }).first().click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByLabel('Interview duration')).toHaveValue('60');
  const moved = new Date(Date.now() + 9 * 86400_000);
  await edit.locator('input[type="date"]').fill(ymd(moved));
  await edit.getByRole('button', { name: /save new time/i }).click();

  await expect.poll(async () => ymd(new Date((await scheduleFor(request, auth, interviewId)).scheduledAt)))
    .toBe(ymd(moved));
  await page.reload();
  await openHistory(page);
  await expect(page.getByText(/Rescheduled from/i).first()).toBeVisible();

  await page.getByRole('button', { name: /cancel interview/i }).first().click();
  const confirm = page.getByRole('dialog');
  await confirm.getByRole('button', { name: /^cancel interview$/i }).click();
  await expect(confirm.getByText(/reason is required/i)).toBeVisible();
  await confirm.getByLabel('Reason').fill('Candidate requested a new booking');
  await confirm.getByRole('button', { name: /^cancel interview$/i }).click();

  await expect.poll(async () => (await scheduleFor(request, auth, interviewId)).status)
    .toBe('Cancelled');
  const detail = await request.get(`/api/candidates/${candidateId}`, { headers: auth });
  expect((await detail.json()).currentStatus).toBe('Call for Interview');

  const rebooked = await changeStatus({
    status: 'Interview Scheduled',
    interviewAt: new Date(Date.now() + 11 * 86400_000).toISOString(),
    interviewerUserIds: [interviewer.id],
  });
  expect(rebooked.interviewId).not.toBe(interviewId);
  expect((await scheduleFor(request, auth, rebooked.interviewId)).status).toBe('Scheduled');
});
