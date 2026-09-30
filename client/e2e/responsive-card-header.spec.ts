import { test, expect } from '@playwright/test';

/**
 * Issue #72. `CardHeader` is one flex row and `CardAction` is `shrink-0`, so on a
 * narrow viewport the title used to absorb every pixel of loss and collapse to
 * 0px wide, spilling its text under the actions. jsdom has no layout, so a
 * Vitest test cannot see this; it only shows up in a real browser.
 *
 * Credentials come from the environment so no secret is committed.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

/** Optional: an interview the logged-in user can open, for the chip-icon check. */
const interviewId = process.env.E2E_INTERVIEW_ID;

type HeaderProbe = { title: string; width: number; collides: boolean };

const probeHeaders = (): HeaderProbe[] =>
  [...document.querySelectorAll('[data-slot="card-header"]')].flatMap((el) => {
    const t = el.querySelector('[data-slot="card-title"]');
    const a = el.querySelector('[data-slot="card-action"]');
    if (!t || !a) return [];
    const tr = t.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const sameRow = !(tr.bottom <= ar.top + 1 || ar.bottom <= tr.top + 1);
    return [{
      title: (t.textContent ?? '').trim().slice(0, 40),
      width: tr.width,
      collides: sameRow && tr.right > ar.left + 1,
    }];
  });

test.describe('responsive card header (issue #72)', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run this test.');

  test('card titles never collapse or collide at phone widths', async ({ page }) => {
    // The dashboard alone does NOT cover this: its card actions are small enough
    // to fit, so it passed even against the unfixed code. The evaluation card is
    // the one with wide actions (a rubric badge plus a nowrap "Rated n of m"),
    // which is what actually crushes the title, so the interview page is the
    // meaningful surface. Both are checked; the interview one is the regression.
    test.skip(!interviewId, 'Set E2E_INTERVIEW_ID to an interview the user can open.');

    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('[data-slot="card-header"]').first()).toBeVisible();

    for (const path of ['/', `/interviews/${interviewId}`]) {
      await page.goto(path);
      await expect(page.locator('[data-slot="card-header"]').first()).toBeVisible();

      for (const width of [320, 360, 390, 405]) {
        await page.setViewportSize({ width, height: 1000 });
        const headers = await page.evaluate(probeHeaders);
        expect(headers.length, `no card headers on ${path} at ${width}px`).toBeGreaterThan(0);

        for (const h of headers) {
          expect(h.width, `"${h.title}" collapsed on ${path} at ${width}px`).toBeGreaterThan(0);
          expect(h.collides, `"${h.title}" collides with its actions on ${path} at ${width}px`).toBe(false);
        }
      }
    }
  });

  test('the interview chip icon keeps its size and rides the first line', async ({ page }) => {
    test.skip(!interviewId, 'Set E2E_INTERVIEW_ID to an interview the user can open.');

    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Wait for the app shell before navigating, or the goto races the redirect.
    await expect(page.locator('[data-slot="card-header"]').first()).toBeVisible();

    await page.goto(`/interviews/${interviewId}`);
    const chip = page.locator('.interview-chip').first();
    await expect(chip).toBeVisible();

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const m = await chip.evaluate((el) => {
        const svg = el.querySelector('svg')!;
        const s = svg.getBoundingClientRect();
        const c = el.getBoundingClientRect();
        return { iconWidth: s.width, iconCentre: s.top + s.height / 2 - c.top, chipHeight: c.height };
      });

      // Never squashed by its flex parent.
      expect(Math.round(m.iconWidth), `icon squashed at ${width}px`).toBe(15);
      // On a wrapped chip the icon sits on the first line, not mid-block.
      if (m.chipHeight > 34) {
        expect(m.iconCentre, `icon not on the first line at ${width}px`).toBeLessThan(m.chipHeight / 2);
      }
    }
  });
});
