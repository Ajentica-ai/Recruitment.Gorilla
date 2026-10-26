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
 * repointed alongside this fix. That rule is inert, and correctly so: it sits
 * in a >=992px block keyed on `.interview-grid`, a two-panel layout the Harbor
 * redesign (#35) replaced with the full-width `.interview-studio-container`.
 * Repointing keeps the selector honest; there is no pinned footer to assert.
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

/**
 * Wait until the stylesheet is actually in effect before measuring. A page
 * caught mid-reload renders the markup with no CSS applied, and an unstyled
 * row measures exactly like the bug this spec guards, so without this the
 * test can fail for a reason that has nothing to do with the fix.
 */
async function waitForActionsStyled(page: Page) {
  await expect
    .poll(
      () =>
        page
          .locator('.eval-form-actions')
          .first()
          .evaluate((el) => getComputedStyle(el).display),
      { timeout: 10_000, message: '.eval-form-actions should be laid out as flex' },
    )
    .toBe('flex');
}

/**
 * Both rectangles, read in one browser call. Two separate `boundingBox()` calls are two round trips: if
 * the page shifts by a pixel or two between them (late layout, a font swap) the pair describes two
 * different moments and identical, aligned buttons look misaligned (#177).
 */
async function measureButtons(page: Page) {
  const save = page.getByRole('button', { name: /Save draft/i }).first();
  const submit = page.getByRole('button', { name: /Submit evaluation/i }).first();
  await expect(save).toBeVisible();
  await expect(submit).toBeVisible();
  const [a, b] = await page.evaluate(
    ([s, u]) => [s, u].map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
    [await save.elementHandle(), await submit.elementHandle()] as const,
  );
  return { a, b };
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

    await waitForActionsStyled(page);
    const { a, b } = await measureButtons(page);
    await page.screenshot({ path: shotPath('rg68_eval_actions_desktop.png'), fullPage: true });

    // Side by side at this width: they share one row. Compare the vertical centres with a couple of
    // pixels of slack. Their top edges can differ by a pixel or more under load (sub-pixel layout), so
    // a half-pixel check on `y` failed on identical buttons (#177).
    const centreDelta = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2));
    expect(centreDelta, `vertical centres of the two buttons differ by ${centreDelta}px`).toBeLessThan(2);
    // The gap is the horizontal distance between them.
    const gap = b.x - (a.x + a.width);
    expect(gap, `horizontal gap between the two buttons (got ${gap}px)`).toBeGreaterThan(4);
  });

  test('the row still separates its buttons at phone width', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await page.setViewportSize(PHONE);
    test.skip(!(await openEvaluation(page)), 'no interview with an evaluation form in this database');

    await waitForActionsStyled(page);
    const { a, b } = await measureButtons(page);
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
