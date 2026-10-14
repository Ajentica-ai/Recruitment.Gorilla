import { expect, test, type Page } from '@playwright/test';
import { shotPath } from './helpers';

/**
 * Issue #68.
 *
 * `EvaluationForm` renders its footer as `.eval-form-actions` with a
 * `__hint` and a `__buttons` child. Commit 33ed80a renamed the row from
 * `form-actions` to that BEM trio and never added the matching CSS, so all
 * three classes styled nothing: the gap that `.form-actions` supplied was
 * lost and "Save draft" sat flush against "Submit evaluation".
 *
 * The same rename orphaned `.eval-form-card .form-actions { flex-shrink: 0 }`,
 * repointed alongside this fix. That rule is inert today: it only bites once
 * the card is height-capped, which needs `.interview-grid`, and that class is
 * applied nowhere in the app. Repointed anyway so it is correct when it is.
 * Not tested here, because there is no pinned footer to assert yet.
 *
 * Measured rather than eyeballed, following rubric-editor-layout.spec.ts: two
 * buttons with no space between them are both perfectly visible, so only the
 * geometry catches this.
 */
/**
 * The form renders only for an assigned interviewer (`canEvaluate`), which is
 * neither E2E_EMAIL's Recruiter nor E2E_ADMIN_EMAIL's Admin by default, so this
 * spec has its own pair. There is no interview list route, only /interviews/:id.
 */
const email = process.env.E2E_INTERVIEWER_EMAIL;
const password = process.env.E2E_INTERVIEWER_PASSWORD ?? process.env.DEMO_PASSWORD;
const interviewId = process.env.E2E_INTERVIEW_ID;

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

async function signIn(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

/**
 * Open the configured interview and wait for its evaluation form. Returns false
 * rather than failing when that interview has no form to show, so the spec
 * skips the way the rest of the suite does on a thin database.
 */
async function openEvaluation(page: Page): Promise<boolean> {
  await page.goto(`/interviews/${interviewId}`);
  // waitFor, not isVisible: the latter does not retry, so it answers before the
  // page has rendered and the spec skips itself on a perfectly good interview.
  return page
    .locator('.eval-form-actions')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
}

test.describe('Evaluation actions row spacing', () => {
  test.skip(
    !email || !password || !interviewId,
    'Set E2E_INTERVIEWER_EMAIL, E2E_INTERVIEWER_PASSWORD and E2E_INTERVIEW_ID.',
  );

  test('Save draft and Submit evaluation do not touch', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.setViewportSize(DESKTOP);
    test.skip(!(await openEvaluation(page)), 'no interview with an evaluation form in this database');

    const save = page.getByRole('button', { name: /Save draft/i }).first();
    const submit = page.getByRole('button', { name: /Submit evaluation/i }).first();
    await expect(save).toBeVisible();
    await expect(submit).toBeVisible();

    const a = (await save.boundingBox())!;
    const b = (await submit.boundingBox())!;
    await page.screenshot({ path: shotPath('rg68_eval_actions_desktop.png'), fullPage: true });

    // Side by side at this width, so the gap is the horizontal distance between them.
    expect(a.y).toBeCloseTo(b.y, 0);
    const gap = b.x - (a.x + a.width);
    expect(gap, `horizontal gap between the two buttons (got ${gap}px)`).toBeGreaterThan(4);
  });

  test('the row still separates its buttons at phone width', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.setViewportSize(PHONE);
    test.skip(!(await openEvaluation(page)), 'no interview with an evaluation form in this database');

    const save = page.getByRole('button', { name: /Save draft/i }).first();
    const submit = page.getByRole('button', { name: /Submit evaluation/i }).first();
    const a = (await save.boundingBox())!;
    const b = (await submit.boundingBox())!;
    await page.screenshot({ path: shotPath('rg68_eval_actions_phone.png'), fullPage: true });

    // They may sit side by side or stack; either way they must not touch.
    const horizontal = b.x - (a.x + a.width);
    const vertical = b.y - (a.y + a.height);
    expect(
      Math.max(horizontal, vertical),
      `buttons must be separated on one axis (h=${horizontal}px, v=${vertical}px)`,
    ).toBeGreaterThan(4);
  });
});
