import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ADMIN, RECRUITER, apiAuth, requireData, signIn } from './helpers';
import { seedCandidate, uploadDraft } from './seed';

/** Job openings the given caller may use: every active opening for Admin+, only the assigned ones for a Recruiter. */
async function rolesFor(request: APIRequestContext, auth: Record<string, string>): Promise<{ id: number }[]> {
  const res = await request.get('/api/candidates/role-options', { headers: auth });
  expect(res.ok(), `role-options failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

/**
 * Regression guard for #50: a Recruiter reaches Upload CVs and Candidates, but only their own work.
 *
 * The pages themselves are open to Recruiters by design (ai-docs/auth.md): they upload CVs and
 * become the owner of the candidates they create. What #50 exposed was the scope behind them. The
 * draft list was limited to the caller's uploads while every by-id path loaded drafts by id alone,
 * so a Recruiter could read, edit, approve or discard anyone's parsed CV (fixed in #103).
 *
 * So this checks both sides as the Recruiter: the pages and their own upload work, and an Admin's
 * draft and candidate are invisible and untouchable. Every refusal is then confirmed from the
 * Admin's side, so a write that answered "not found" but went through anyway still fails.
 */
const ALL_PENDING = '/api/candidate-drafts?status=Pending&pageSize=200';

async function draftIds(request: APIRequestContext, auth: Record<string, string>): Promise<number[]> {
  const res = await request.get(ALL_PENDING, { headers: auth });
  expect(res.ok(), `draft list failed: ${res.status()}`).toBeTruthy();
  return (await res.json()).items.map((d: { id: number }) => d.id);
}

test.describe('a Recruiter works only their own CVs and candidates', () => {
  test.skip(
    !RECRUITER.email || !RECRUITER.password || !ADMIN.email || !ADMIN.password,
    'Set E2E_EMAIL/E2E_PASSWORD (a Recruiter) and E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (an Admin).',
  );

  test('Upload CVs and Candidates open for a Recruiter', async ({ page }) => {
    await signIn(page, RECRUITER);

    await page.getByRole('link', { name: 'Upload CVs' }).first().click();
    await expect(page).toHaveURL(/\/upload$/);
    await expect(page.getByText('Drop CVs in bulk, review what was extracted').first()).toBeVisible();

    await page.getByRole('link', { name: 'Candidates' }).first().click();
    await expect(page).toHaveURL(/\/candidates$/);
    await expect(page.getByText('Search, filter and manage every candidate').first()).toBeVisible();
  });

  test("a Recruiter sees their own draft and none of an Admin's", async ({ request }) => {
    const admin = await apiAuth(request, ADMIN);
    const recruiter = await apiAuth(request, RECRUITER);

    // The Admin's draft must be for an opening the Recruiter is NOT assigned to, or scoping
    // would legitimately show it to them (RG130) and this test would prove nothing.
    const recruiterRoleIds = new Set((await rolesFor(request, recruiter)).map((r) => r.id));
    const outsideRole = (await rolesFor(request, admin)).find((r) => !recruiterRoleIds.has(r.id));
    requireData(outsideRole !== undefined, 'a job opening the test Recruiter is not assigned to');

    const adminsDraft = await uploadDraft(request, admin, `RG50 Admin Draft ${randomUUID()}`, outsideRole!.id);
    const ownDraft = await uploadDraft(request, recruiter, `RG50 Own Draft ${randomUUID()}`);

    try {
      // Their own upload: listed and readable.
      expect(await draftIds(request, recruiter)).toContain(ownDraft.id);
      expect((await request.get(`/api/candidate-drafts/${ownDraft.id}`, { headers: recruiter })).status()).toBe(200);

      // The Admin's upload: not listed, and every by-id path reads as not found.
      expect(await draftIds(request, recruiter)).not.toContain(adminsDraft.id);
      const byId = `/api/candidate-drafts/${adminsDraft.id}`;
      expect((await request.get(byId, { headers: recruiter })).status()).toBe(404);
      expect((await request.put(byId, { headers: recruiter, data: { fullName: 'RG50 Overwritten' } })).status()).toBe(404);
      expect((await request.post(`${byId}/discard`, { headers: recruiter })).status()).toBe(404);

      const approve = await request.post(`${byId}/approve`, {
        headers: recruiter,
        data: { fullName: 'RG50 Taken', email: `rg50-${randomUUID()}@example.invalid`, relevantExperience: '1 year' },
      });
      expect(approve.status()).toBe(400);
      expect(await approve.text()).toContain('not found');

      // The bulk forms skip it rather than failing the whole request.
      const bulkApprove = await request.post('/api/candidate-drafts/bulk-approve', {
        headers: recruiter,
        data: { draftIds: [adminsDraft.id], defaultRelevantExperience: '1 year' },
      });
      expect((await bulkApprove.json()).approvedCount).toBe(0);
      const bulkDiscard = await request.post('/api/candidate-drafts/bulk-discard', {
        headers: recruiter,
        data: { draftIds: [adminsDraft.id] },
      });
      expect((await bulkDiscard.json()).discardedCount).toBe(0);

      // And none of it landed: the Admin still sees the draft pending and unedited.
      const after = await (await request.get(byId, { headers: admin })).json();
      expect(after.status).toBe('Pending');
      expect(after.fullName).not.toBe('RG50 Overwritten');
    } finally {
      await request.post(`/api/candidate-drafts/${adminsDraft.id}/discard`, { headers: admin }).catch(() => {});
      await request.post(`/api/candidate-drafts/${ownDraft.id}/discard`, { headers: recruiter }).catch(() => {});
    }
  });

  test("a Recruiter can see and approve an Admin's draft for their assigned job opening (RG130)", async ({ request }) => {
    const admin = await apiAuth(request, ADMIN);
    const recruiter = await apiAuth(request, RECRUITER);

    const assignedRoles = await rolesFor(request, recruiter);
    requireData(assignedRoles.length > 0, 'a job opening the test Recruiter is assigned to');
    const roleId = assignedRoles[0].id;

    const draft = await uploadDraft(request, admin, `RG130 Assigned Draft ${randomUUID()}`, roleId);
    let candidateId: number | undefined;
    try {
      expect(await draftIds(request, recruiter)).toContain(draft.id);
      expect((await request.get(`/api/candidate-drafts/${draft.id}`, { headers: recruiter })).status()).toBe(200);

      const approve = await request.post(`/api/candidate-drafts/${draft.id}/approve`, {
        headers: recruiter,
        data: {
          fullName: 'RG130 Assigned Candidate',
          email: `rg130-${randomUUID()}@example.invalid`,
          relevantExperience: '1 year',
          roleAppliedOptionId: roleId,
        },
      });
      expect(approve.ok(), `approve failed: ${approve.status()} ${await approve.text()}`).toBeTruthy();
      candidateId = (await approve.json()).candidateId as number;
    } finally {
      await request.post(`/api/candidate-drafts/${draft.id}/discard`, { headers: admin }).catch(() => {});
      if (candidateId) await request.delete(`/api/candidates/${candidateId}`, { headers: admin }).catch(() => {});
    }
  });

  test("a Recruiter cannot see an Admin's candidate outside their job openings", async ({ request }) => {
    const admin = await apiAuth(request, ADMIN);
    const recruiter = await apiAuth(request, RECRUITER);
    // Owned by the Admin and in no job opening, so no Recruiter is assigned to it.
    const label = `RG50 Scope Probe ${randomUUID().slice(0, 8)}`;
    const candidateId = await seedCandidate(request, admin, label);

    try {
      const detail = await (await request.get(`/api/candidates/${candidateId}`, { headers: admin })).json();
      const fileId = detail.cvFiles[0].id;

      const list = await (
        await request.get(`/api/candidates?search=${encodeURIComponent(label)}`, { headers: recruiter })
      ).json();
      expect(list.items.map((c: { id: number }) => c.id)).not.toContain(candidateId);
      expect((await request.get(`/api/candidates/${candidateId}`, { headers: recruiter })).status()).toBe(404);
      expect(
        (await request.get(`/api/candidates/${candidateId}/cv/${fileId}`, { headers: recruiter })).status(),
      ).toBe(404);
    } finally {
      await request.delete(`/api/candidates/${candidateId}`, { headers: admin }).catch(() => {});
    }
  });
});
