import { expect, test, type Page } from '@playwright/test';
import { RECRUITER, shotPath, signIn } from './helpers';

/**
 * The dashboard is mobile first (RG-134): one column and sideways snap strips
 * on a phone, grids from 768px, two-column rows from 1200px.
 *
 * Checked at each width in both themes, by geometry and visibility rather than
 * class names, plus a full-page screenshot per combination for review against
 * the signed-off mockup.
 */
const WIDTHS = [360, 390, 768, 1280, 1600] as const;
const THEMES = ['light', 'dark'] as const;

async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-bs-theme', t), theme);
}

test.describe('dashboard is responsive', () => {
  test.skip(!RECRUITER.email || !RECRUITER.password, 'Set E2E_EMAIL and E2E_PASSWORD (a Recruiter).');

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`${width}px ${theme}`, async ({ page }) => {
        await signIn(page, RECRUITER);
        // The KPI figures count up; reduced motion draws them final, so screenshots show real values.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await setTheme(page, theme);

        const figures = page.getByRole('group', { name: 'Pipeline figures' });
        await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible();
        await expect(figures).toBeVisible();

        // Nothing may push the page sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'horizontal page overflow in px').toBeLessThanOrEqual(0);

        // The floating Upload CVs button is the phone's primary action only.
        const fab = page.locator('.quick-fab');
        if (width < 768) await expect(fab).toBeVisible();
        else await expect(fab).toBeHidden();

        // On a phone the KPI tiles are one sideways strip: it scrolls, the page doesn't.
        // Pointer off the tiles first: a hovered tile lifts 2px. Rows are bucketed to 10px.
        await page.mouse.move(0, 0);
        const strip = await figures.evaluate((el) => ({
          scrolls: el.scrollWidth > el.clientWidth,
          rows: new Set(Array.from(el.children).map((c) => Math.round(c.getBoundingClientRect().top / 10))).size,
        }));
        if (width < 768) {
          expect(strip.scrolls).toBe(true);
          expect(strip.rows).toBe(1);
        } else {
          expect(strip.scrolls).toBe(false);
          expect(strip.rows).toBe(2);
        }

        await page.screenshot({ path: shotPath(`dashboard-${width}-${theme}.png`), fullPage: true });
      });
    }
  }

  test('pipeline "Active" hides the intake stage and stage rows drill through', async ({ page }) => {
    await signIn(page, RECRUITER);
    await page.goto('/');

    const pipeline = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('heading', { name: 'Pipeline', exact: true }) });
    const rows = pipeline.getByRole('link', { name: /candidates, .* percent/ });
    await page.waitForLoadState('networkidle');
    test.skip((await rows.count()) === 0, 'No candidates in the dev database.');

    await pipeline.getByRole('radio', { name: 'Active' }).click();
    await expect(pipeline.getByRole('link', { name: /^Uploaded:/ })).toHaveCount(0);

    const first = rows.first();
    const name = (await first.getAttribute('aria-label'))!.split(':')[0];
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/candidates\\?status=${encodeURIComponent(name).replace(/%20/g, '(%20|\\+)')}`));
  });
});
