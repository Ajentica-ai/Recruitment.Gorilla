import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared bits for the E2E suite, so the specs stop hardcoding them.
 *
 * Three things were duplicated or wrong across the suite (#83): an absolute
 * screenshot path belonging to one developer's machine, a sign-in block copied
 * seven times, and specs that failed rather than skipped when the dev database
 * had nothing for them to look at.
 */

/**
 * Where screenshots go. Defaults under `test-results/`, which Playwright owns
 * and `client/.gitignore` already ignores, so captures never land in a commit.
 * Override with `E2E_SHOT_DIR` to collect them somewhere else.
 */
export function shotDir(...segments: string[]): string {
  const base = process.env.E2E_SHOT_DIR ?? path.join('test-results', 'screenshots');
  const dir = path.join(base, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** A screenshot path inside `shotDir()`, with the directory already created. */
export function shotPath(name: string): string {
  return path.join(shotDir(), name);
}

export const RECRUITER = {
  email: process.env.E2E_EMAIL,
  password: process.env.E2E_PASSWORD,
};

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD,
};

/**
 * Sign in through the form.
 *
 * Always starts wide: below `sm` the nav collapses behind a hamburger, so a
 * post-login assertion against a nav link fails for layout reasons rather than
 * auth ones. Specs that want a narrow viewport set it after this returns.
 */
export async function signIn(
  page: Page,
  who: { email?: string; password?: string } = RECRUITER,
): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(who.email!);
  await page.locator('input[type="password"]').fill(who.password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Candidates' }).first()).toBeVisible();
}

/** An access token for the API, for seeding or for checking what data exists. */
export async function apiAuth(
  request: APIRequestContext,
  who: { email?: string; password?: string } = ADMIN,
): Promise<Record<string, string>> {
  const res = await request.post('/api/auth/login', {
    data: { email: who.email, password: who.password },
  });
  expect(res.ok(), `login failed for ${who.email}: ${res.status()}`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

/**
 * Skip when the data a spec needs is not in the dev database.
 *
 * The distinction this draws is the point: a spec that cannot see a dashboard
 * card because nothing has been uploaded has not found a bug, it has found an
 * empty database. Failing there trains people to ignore red, which is how the
 * stale selectors in `kanban-pipeline.spec.ts` survived a whole UI migration
 * unnoticed. So the suite says what is missing and moves on.
 */
export function requireData(present: boolean, what: string): void {
  test.skip(!present, `Needs ${what} in the dev database; none found.`);
}

/**
 * An open job opening the signed-in caller may use for a CV upload or import, or `undefined` if
 * none exists: an Admin+ sees every active, open opening; a Recruiter only the ones they are
 * assigned to. A CV upload and a JSON import both now require one.
 */
export async function openRoleId(
  request: APIRequestContext,
  auth: Record<string, string>,
): Promise<number | undefined> {
  const res = await request.get('/api/candidates/role-options', { headers: auth });
  if (!res.ok()) return undefined;
  const roles = await res.json();
  return Array.isArray(roles) && roles.length > 0 ? roles[0].id : undefined;
}

/** How many candidates the signed-in user can see. */
export async function candidateCount(
  request: APIRequestContext,
  auth: Record<string, string>,
): Promise<number> {
  const res = await request.get('/api/candidates?page=1&pageSize=1', { headers: auth });
  if (!res.ok()) return 0;
  const body = await res.json();
  if (typeof body?.totalCount === 'number') return body.totalCount;
  if (typeof body?.total === 'number') return body.total;
  return Array.isArray(body) ? body.length : (body?.items?.length ?? 0);
}

/**
 * A fresh set of CV fixtures that no earlier upload has ever seen.
 *
 * Since #93 the API refuses a CV whose bytes it already holds, matched by
 * content hash against pending drafts and against every approved candidate's
 * CV, which never goes away. Reusing one fixed set therefore fails on every run
 * after the first, and two specs sharing a file in the same run collide with
 * each other: bulk-upload's ten included the very CV education-experience
 * uploads.
 *
 * So each call writes its own set into its own directory, with a unique salt
 * that the generator puts in a PDF comment. That changes every file's hash and
 * nothing the parser reads. The directory sits under `test-results/`, which is
 * already gitignored and which Playwright clears itself.
 */
export function freshTestCvs(): string[] {
  const salt = randomUUID();
  const out = path.join('test-results', 'cvs', salt);
  try {
    execFileSync(process.execPath, ['e2e/make-test-cvs.mjs', '--salt', salt, '--out', out], {
      stdio: 'pipe',
    });
  } catch (err) {
    // Reported by the caller's skip, so the reason reaches the test output
    // rather than disappearing.
    console.warn(`could not generate test CVs: ${(err as Error).message}`);
    return [];
  }
  return fs
    .readdirSync(out)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map((f) => path.join(out, f));
}
