import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN, RECRUITER, apiAuth, requireData } from './helpers';

/**
 * The use case behind sharing evaluations (#182), as seen by the person it is shared with (#186):
 * two interviewers (an Admin and a Recruiter play A and B) submit round 1, the Recruiter shares the
 * candidate with C, an Interviewer-only user, and C opens the notification, reads both evaluations,
 * and still cannot open the candidate.
 *
 * It books a real interview, which moves a candidate (Uploaded, then Call for Interview, then
 * Interview Scheduled) and leaves submitted evaluations, a grant and notifications behind. Run it
 * against a throwaway database, never the dev one. Each run uses up one candidate that is still at
 * Uploaded and visible to the Recruiter, so seed a few.
 */
const INTERVIEWER = {
  email: process.env.E2E_INTERVIEWER_EMAIL,
  password: process.env.E2E_INTERVIEWER_PASSWORD ?? process.env.DEMO_PASSWORD,
};

/**
 * `signIn` in helpers waits for the Candidates nav link, which an Interviewer-only user does not
 * have, so this signs in and waits for the dashboard hero instead.
 */
async function signInAsInterviewer(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(INTERVIEWER.email!);
  await page.locator('input[type="password"]').fill(INTERVIEWER.password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
}

interface Setup {
  candidateId: number;
  candidateName: string;
  adminName: string;
  recruiterName: string;
}

async function ok(res: { ok(): boolean; status(): number; text(): Promise<string> }, what: string) {
  expect(res.ok(), `${what} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function bookAndShare(request: APIRequestContext): Promise<Setup | undefined> {
  const recruiter = await apiAuth(request, RECRUITER);
  const admin = await apiAuth(request, ADMIN);

  const list = await request.get('/api/candidates?page=1&pageSize=50&status=Uploaded', { headers: recruiter });
  if (!list.ok()) return undefined;
  const candidate = ((await list.json()).items ?? [])[0] as { id: number; fullName: string } | undefined;
  if (!candidate) return undefined;

  const usersRes = await request.get('/api/interviews/assignable-users', { headers: recruiter });
  await ok(usersRes, 'assignable-users');
  const users = (await usersRes.json()) as { id: number; name: string; email: string }[];
  const byEmail = (email?: string) => users.find((u) => u.email.toLowerCase() === email?.toLowerCase());
  const a = byEmail(ADMIN.email);
  const b = byEmail(RECRUITER.email);
  const c = byEmail(INTERVIEWER.email);
  if (!a || !b || !c) return undefined;

  // Uploaded -> Call for Interview -> Interview Scheduled, with A and B on the panel.
  await ok(
    await request.post(`/api/candidates/${candidate.id}/status`, {
      headers: recruiter,
      data: { status: 'Call for Interview', comment: 'e2e: shared-with-me' },
    }),
    'Call for Interview',
  );
  await ok(
    await request.post(`/api/candidates/${candidate.id}/status`, {
      headers: recruiter,
      data: {
        status: 'Interview Scheduled',
        comment: 'e2e: shared-with-me',
        interviewAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        interviewerUserIds: [a.id, b.id],
        interviewDurationMinutes: 60,
      },
    }),
    'Interview Scheduled',
  );

  const detail = await request.get(`/api/candidates/${candidate.id}`, { headers: recruiter });
  await ok(detail, 'candidate detail');
  const entry = ((await detail.json()).statusHistory as { status: string; interviewId?: number }[]).find(
    (h) => h.status === 'Interview Scheduled' && h.interviewId,
  );
  const interviewId = entry!.interviewId!;

  const rubricRes = await request.get(`/api/evaluation-rubrics/for-interview/${interviewId}`, { headers: admin });
  await ok(rubricRes, 'rubric');
  const keys = ((await rubricRes.json()).criteria as { key: string }[]).map((k) => k.key);

  for (const [who, auth] of [[a, admin], [b, recruiter]] as const) {
    await ok(
      await request.put(`/api/interviews/${interviewId}/evaluation`, {
        headers: auth,
        data: {
          generalAssessment: `Solid candidate, per ${who.name}.`,
          recommendation: 'Recommended',
          overallRating: 4,
          items: keys.map((key) => ({ criterionKey: key, rating: 4, comment: null })),
          submit: true,
        },
      }),
      `evaluation by ${who.name}`,
    );
  }

  await ok(
    await request.post(`/api/candidates/${candidate.id}/evaluation-shares`, {
      headers: recruiter,
      data: { granteeUserIds: [c.id], note: 'Please read before your round' },
    }),
    'share',
  );

  return { candidateId: candidate.id, candidateName: candidate.fullName, adminName: a.name, recruiterName: b.name };
}

test.describe('an Interviewer reads evaluations shared with them', () => {
  test.skip(
    !RECRUITER.email || !RECRUITER.password || !ADMIN.email || !ADMIN.password || !INTERVIEWER.email || !INTERVIEWER.password,
    'Set E2E_EMAIL/E2E_PASSWORD (Recruiter), E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD and E2E_INTERVIEWER_EMAIL/E2E_INTERVIEWER_PASSWORD.',
  );

  test('opens the notification, reads both evaluations, and still cannot open the candidate', async ({
    page,
    request,
  }) => {
    const setup = await bookAndShare(request);
    requireData(setup !== undefined, 'an Uploaded candidate the Recruiter can see, plus the three E2E users');
    const { candidateId, candidateName, adminName, recruiterName } = setup!;

    await signInAsInterviewer(page);

    // The dashboard lists what was shared.
    await expect(page.getByRole('heading', { name: 'Shared with me' })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(candidateName) })).toBeVisible();

    // The notification opens the shared report.
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page
      .getByRole('button', { name: /Interview evaluations shared with you/ })
      .filter({ hasText: candidateName })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/shared/candidates/${candidateId}/evaluations$`));

    const banner = page.getByLabel('About this share');
    await expect(banner).toContainText('Shared with you by');
    await expect(banner).toContainText('Please read before your round');
    await expect(page.getByText(adminName).first()).toBeVisible();
    await expect(page.getByText(recruiterName).first()).toBeVisible();

    // The read-only profile is there too.
    await expect(page.getByRole('heading', { name: 'Candidate profile' })).toBeVisible();

    // But the candidate itself is out of reach.
    const interviewer = await apiAuth(request, INTERVIEWER);
    expect((await request.get(`/api/candidates/${candidateId}`, { headers: interviewer })).status()).toBe(403);
    await page.goto(`/candidates/${candidateId}`);
    await expect(page).not.toHaveURL(new RegExp(`/candidates/${candidateId}$`));
  });
});
