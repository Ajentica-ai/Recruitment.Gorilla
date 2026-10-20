import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { RECRUITER, apiAuth, requireData, signIn } from './helpers';

/**
 * Sharing evaluations from the candidate page (#185): a Recruiter shares one round with an
 * Interviewer, sees the row, and revokes it.
 *
 * Data comes from the database rather than being created: a candidate the Recruiter can see that
 * already has a live interview (found through the share-options endpoint the drawer itself uses),
 * and the Interviewer named by E2E_INTERVIEWER_EMAIL. A revoke is a soft delete, so a run leaves one
 * revoked row and one audit entry behind; run it against a throwaway database, not the dev one.
 */
const INTERVIEWER_EMAIL = process.env.E2E_INTERVIEWER_EMAIL;

interface Target {
  candidateId: number;
  interviewerName: string;
}

async function findTarget(request: APIRequestContext): Promise<Target | undefined> {
  const auth = await apiAuth(request, RECRUITER);
  const list = await request.get('/api/candidates?page=1&pageSize=50', { headers: auth });
  if (!list.ok()) return undefined;
  for (const c of (await list.json()).items ?? []) {
    const res = await request.get(`/api/candidates/${c.id}/evaluation-shares/options`, { headers: auth });
    if (!res.ok()) continue;
    const options = await res.json();
    const interviewer = options.users.find(
      (u: { email: string; alreadyHasAccess: boolean }) =>
        u.email.toLowerCase() === INTERVIEWER_EMAIL?.toLowerCase() && !u.alreadyHasAccess,
    );
    if (options.interviews.length > 0 && interviewer) {
      return { candidateId: c.id, interviewerName: interviewer.name };
    }
  }
  return undefined;
}

async function openShareDrawer(page: Page, candidateId: number) {
  await page.goto(`/candidates/${candidateId}`);
  await page.getByRole('button', { name: 'Share evaluations' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Share evaluations' })).toBeVisible();
}

test.describe('share evaluations from the candidate page', () => {
  test.skip(
    !RECRUITER.email || !RECRUITER.password || !INTERVIEWER_EMAIL,
    'Set E2E_EMAIL/E2E_PASSWORD (a Recruiter) and E2E_INTERVIEWER_EMAIL.',
  );

  test('a Recruiter shares one round with an Interviewer, sees the row, then revokes it', async ({
    page,
    request,
  }) => {
    const target = await findTarget(request);
    requireData(
      target !== undefined,
      'a candidate the Recruiter can see with a live interview, and the E2E interviewer as a user',
    );

    await signIn(page, RECRUITER);
    await openShareDrawer(page, target!.candidateId);
    const drawer = page.getByRole('dialog');

    // Pick the person, then one specific interview.
    await drawer.getByRole('combobox').click();
    await page.getByRole('option', { name: new RegExp(target!.interviewerName) }).click();
    // The multi-select stays open after a pick; clicking elsewhere closes it, as a person would.
    await drawer.getByRole('heading', { name: 'Share evaluations' }).click();
    await drawer.getByLabel('Specific interviews').click();
    await drawer.getByLabel('Interviews to share').getByRole('checkbox').first().click();
    await drawer.getByRole('button', { name: 'Share', exact: true }).click();

    await expect(page.getByText('Shared with 1 person.')).toBeVisible();
    const active = drawer.getByLabel('Active shares');
    await expect(active).toContainText(target!.interviewerName);
    await expect(active).toContainText('Interview on');

    // The report page offers the same action and says who has it.
    await drawer.getByRole('button', { name: 'Done' }).click();
    await page.goto(`/candidates/${target!.candidateId}/evaluations`);
    await expect(page.getByRole('button', { name: 'Shared with 1 person' })).toBeVisible();

    // Revoke behind a confirm.
    await page.getByRole('button', { name: 'Shared with 1 person' }).click();
    await page.getByRole('button', { name: `Revoke ${target!.interviewerName}` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Stop sharing?' });
    await confirm.getByRole('button', { name: 'Revoke', exact: true }).click();

    await expect(page.getByText(`Stopped sharing with ${target!.interviewerName}.`)).toBeVisible();
    await expect(page.getByLabel('Active shares')).toHaveCount(0);
    await expect(page.getByText('Not shared with anyone yet.')).toBeVisible();
  });

  test('the action and the drawer fit a phone', async ({ page, request }) => {
    const target = await findTarget(request);
    requireData(target !== undefined, 'a candidate the Recruiter can see with a live interview');

    await signIn(page, RECRUITER);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/candidates/${target!.candidateId}`);

    const open = page.getByRole('button', { name: 'Share evaluations' });
    await expect(open).toBeVisible();
    await open.click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    // Nothing spills past the screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
