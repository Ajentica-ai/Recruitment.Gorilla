import { test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN, apiAuth } from './helpers';

/**
 * Removes what a spec created, so the suite does not grow the shared dev database on every run (#179).
 *
 * The upload and import specs drive the real UI and create fresh drafts and candidates by design
 * (`freshTestCvs()` exists so uploads are never duplicates), and nothing removed them: pending drafts
 * went from 65 to 232 in a handful of runs.
 *
 * Each test records the ids of exactly what it creates by watching its own page's network responses: a CV
 * upload and a JSON import return the new draft, an approval returns the new candidate. Afterwards only
 * those ids are deleted. A "delete everything newer than a snapshot" approach would be simpler, but Playwright
 * runs spec files in parallel, so one spec's cleanup would delete another's data mid-test.
 *
 * Order matters. Candidates go first (the API removes their CV files). Drafts are then discarded, because
 * only a Discarded draft can be deleted, and bulk-deleted; the API keeps a stored file that something else
 * still uses. Needs an Admin account (deleting a candidate is Admin+); without one it warns and does nothing.
 * Cleanup never throws: it must not fail a test.
 */
const BATCH = 100;

export interface CreatedData {
  drafts: Set<number>;
  candidates: Set<number>;
  /** Response bodies still being read; cleanup waits for them so a late response is not missed. */
  pending: Promise<void>[];
}

/** Start recording the drafts and candidates this page creates. Returns the live record. */
export function trackCreatedData(page: Page): CreatedData {
  const created: CreatedData = { drafts: new Set(), candidates: new Set(), pending: [] };

  page.on('response', (res) => {
    if (res.request().method() !== 'POST' || !res.ok()) return;
    const path = new URL(res.url()).pathname;

    const read = async () => {
      if (path === '/api/cvupload') {
        const id = (await res.json())?.id;
        if (typeof id === 'number') created.drafts.add(id);
      } else if (path === '/api/candidate-import') {
        const id = (await res.json())?.draft?.id;
        if (typeof id === 'number') created.drafts.add(id);
      } else {
        const approved = path.match(/^\/api\/candidate-drafts\/(\d+)\/approve$/);
        if (!approved) return;
        created.drafts.add(Number(approved[1]));
        const candidateId = (await res.json())?.candidateId;
        if (typeof candidateId === 'number') created.candidates.add(candidateId);
      }
    };
    created.pending.push(read().catch(() => {}));
  });

  return created;
}

/**
 * Permanently delete drafts: discard first (only a Discarded draft can be deleted), then bulk-delete.
 * Pass the auth of someone who can see them. A stored CV file a candidate still uses is kept by the API.
 * Never throws.
 */
export async function removeDrafts(
  request: APIRequestContext,
  auth: Record<string, string>,
  draftIds: number[],
): Promise<void> {
  for (const id of draftIds) {
    await request.post(`/api/candidate-drafts/${id}/discard`, { headers: auth }).catch(() => {});
  }
  for (let i = 0; i < draftIds.length; i += BATCH) {
    await request
      .post('/api/candidate-drafts/bulk-delete', { headers: auth, data: { draftIds: draftIds.slice(i, i + BATCH) } })
      .catch(() => {});
  }
}

/** Delete exactly what `created` recorded. Never throws. */
export async function cleanupCreated(request: APIRequestContext, created: CreatedData | null): Promise<void> {
  if (!created) return;
  await Promise.all(created.pending);
  if (created.drafts.size === 0 && created.candidates.size === 0) return;

  if (!ADMIN.email || !ADMIN.password) {
    console.warn('E2E cleanup skipped: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to remove test data.');
    return;
  }
  try {
    const auth = await apiAuth(request, ADMIN);

    for (const id of created.candidates) {
      await request.delete(`/api/candidates/${id}`, { headers: auth }).catch(() => {});
    }

    await removeDrafts(request, auth, [...created.drafts]);
  } catch (err) {
    console.warn(`E2E cleanup failed (${(err as Error).message}); test data may have been left behind.`);
  }
}

/** Call inside a `test.describe`: records what each test creates and removes it afterwards. */
export function cleanUpCreatedData(): void {
  let created: CreatedData | null = null;
  test.beforeEach(({ page }) => {
    created = trackCreatedData(page);
  });
  test.afterEach(async ({ request }) => {
    await cleanupCreated(request, created);
  });
}
