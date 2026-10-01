import { expect, test, type Page } from '@playwright/test';

/**
 * Issue #82, plus the criterion-description finding carried over from RG-85.
 *
 * Both rows in the rubric editor were one non-wrapping flex row whose cells
 * could shrink below their own content. Two different symptoms, one shape:
 *
 *  - The "Section N" chip is a flex item with no `shrink-0`, so at phone width
 *    it compressed until the text wrapped *inside* its own tinted background,
 *    and the section-name input next to it truncated mid-word.
 *  - The criterion description sat in a fixed 5-of-12 grid cell, which is
 *    narrower than its content even inside the 52rem drawer.
 *
 * Measured rather than eyeballed, because a chip wrapping inside its background
 * still passes `toBeVisible()` and a clipped input still reports its text.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD;

/** 360 is the narrowest width the repo verifies at; 390 is the issue's own. */
const NARROW = [
  { name: '360', width: 360, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

const DESKTOP = { width: 1280, height: 800 };

async function signIn(page: Page) {
  // Sign in wide: the Configuration link is behind the hamburger at phone width.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Configuration' }).first()).toBeVisible();
}

/** Open the rubric editor and wait out the drawer's enter animation. */
async function openEditor(page: Page) {
  await page.goto('/configuration?tab=rubrics');
  await page.getByRole('button', { name: /Add rubric scorecard/i }).first().click();
  const panel = page.locator('[data-slot="sheet-content"]');
  await expect(panel).toBeVisible();
  await panel.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

/** Geometry of the two cells that used to collapse. */
function probe() {
  const badge = [...document.querySelectorAll('span.badge')].find((b) =>
    /^Section\s*\d/.test((b.textContent ?? '').trim()),
  ) as HTMLElement | undefined;
  const name = document.querySelector('input[placeholder^="Section Name"]') as HTMLInputElement | null;
  const hint = document.querySelector(
    'input[placeholder^="Evaluation guide hint"]',
  ) as HTMLInputElement | null;
  if (!badge || !name || !hint) return null;

  const lineHeight = parseFloat(getComputedStyle(badge).lineHeight);
  return {
    badgeHeight: Math.round(badge.getBoundingClientRect().height),
    // A chip holding one short label should be exactly one line tall. More than
    // that means the text broke inside its own background.
    badgeLines: Math.round(badge.getBoundingClientRect().height / lineHeight),
    nameClips: name.scrollWidth > name.clientWidth + 1,
    nameWidth: Math.round(name.getBoundingClientRect().width),
    hintClips: hint.scrollWidth > hint.clientWidth + 1,
    hintWidth: Math.round(hint.getBoundingClientRect().width),
    hintNeeded: hint.scrollWidth,
  };
}

test.describe('rubric editor rows reflow (issue #82)', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an Admin, for Configuration).',
  );

  for (const vp of NARROW) {
    test(`section header survives ${vp.name}px`, async ({ page }) => {
      await signIn(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openEditor(page);

      const geo = await page.evaluate(probe);
      expect(geo, 'section header cells should all be present').not.toBeNull();

      expect(
        geo!.badgeLines,
        `the "Section N" chip is ${geo!.badgeHeight}px tall, so its label wrapped inside its own background`,
      ).toBe(1);

      expect(
        geo!.nameClips,
        `the section name input is ${geo!.nameWidth}px and cannot show its own value`,
      ).toBe(false);
    });
  }

  test('criterion description is not clipped on the desktop', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(DESKTOP);
    await openEditor(page);

    const geo = await page.evaluate(probe);
    expect(geo, 'criterion cells should all be present').not.toBeNull();

    expect(
      geo!.hintClips,
      `the description input is ${geo!.hintWidth}px but needs ${geo!.hintNeeded}px`,
    ).toBe(false);
  });
});
