import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
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

/** The CV fixtures live outside git, so a spec has to check before using them. */
export function testCvDir(): string {
  return path.resolve('e2e/test-cvs');
}

export function testCvFiles(): string[] {
  const dir = testCvDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * Make sure the CV fixtures exist, generating them if not.
 *
 * `e2e/test-cvs/` is gitignored and always was: the note beside it in
 * `.gitignore` reads "generated test CVs". The generator was simply missing, so
 * the two upload specs could not run on any clone (#83). Running it here means
 * a fresh checkout needs no setup step beyond the credentials file.
 */
export function ensureTestCvs(): string[] {
  const existing = testCvFiles();
  if (existing.length > 0) return existing;
  try {
    execFileSync(process.execPath, ['e2e/make-test-cvs.mjs'], { stdio: 'pipe' });
  } catch (err) {
    // Reported by the caller's skip, so the reason reaches the test output
    // rather than disappearing.
    console.warn(`could not generate test CVs: ${(err as Error).message}`);
  }
  return testCvFiles();
}
