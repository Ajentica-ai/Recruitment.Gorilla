import { expect, test, type Page } from '@playwright/test';

/**
 * Regression guard for #81: a dialog's footer must stay inside the viewport.
 *
 * `DialogBody` scrolls via `flex-1 min-h-0`, which only works on a *direct*
 * flex child of `DialogContent`. Wrapping header/body/footer in a plain
 * `<form>` quietly breaks that: the body grows to its content instead of
 * scrolling, and Save/Cancel end up below the fold with no scrollbar to hint
 * that anything was cut off. That is what #70 reported on the status form.
 *
 * The check is deliberately geometric rather than visual, because
 * `toBeVisible()` passes for an element that is merely painted off-screen,
 * which is exactly the failure mode here.
 *
 * Both dialogs live under Configuration so the spec needs no candidate and
 * writes nothing: it only opens a create form and closes it again.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD;

/** The tall rubric editor is the worst case; the job opening form is the control. */
const DIALOGS = [
  { name: 'rubric editor', tab: 'rubrics', open: /Add rubric scorecard/i },
  { name: 'job opening editor', tab: 'jobs', open: /Add job opening/i },
] as const;

/** A phone, and the short laptop viewport from issue #70's screenshot. */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'short laptop', width: 1279, height: 634 },
] as const;

async function signIn(page: Page) {
  // Sign in wide: the Configuration link sits behind the hamburger at 390px.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Configuration' }).first()).toBeVisible();
}

test.describe('dialog footers stay on screen', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an Admin, for Configuration).',
  );

  for (const vp of VIEWPORTS) {
    for (const dialog of DIALOGS) {
      test(`${dialog.name} at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
        await signIn(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        await page.goto(`/configuration?tab=${dialog.tab}`);
        await page.getByRole('button', { name: dialog.open }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();

        // Let the open animation finish before measuring. Below `sm` the dialog
        // enters with `slide-in-from-bottom-4`, so a rect read on the first
        // frame is a uniform 16px too low and every phone case "fails" by
        // exactly that much.
        await page
          .locator('[data-slot="dialog-content"]')
          .evaluate((el) =>
            Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))),
          );

        const geo = await page.evaluate(() => {
          const pick = (slot: string) =>
            document.querySelector(`[data-slot="${slot}"]`) as HTMLElement | null;
          const body = pick('dialog-body');
          const footer = pick('dialog-footer');
          if (!body || !footer) return null;
          return {
            viewportBottom: window.innerHeight,
            footerBottom: Math.round(footer.getBoundingClientRect().bottom),
            bodyOverflows: body.scrollHeight > body.clientHeight + 1,
            bodyClientHeight: body.clientHeight,
            bodyScrollHeight: body.scrollHeight,
          };
        });

        expect(geo, 'dialog body and footer should both be in the DOM').not.toBeNull();

        // The actual guarantee: the primary action is reachable.
        expect(
          geo!.footerBottom,
          `footer bottom ${geo!.footerBottom}px must be within the ${geo!.viewportBottom}px viewport`,
        ).toBeLessThanOrEqual(geo!.viewportBottom + 1);

        // And when content is too tall, it is the body that absorbs it.
        if (geo!.bodyScrollHeight > geo!.bodyClientHeight + 1) {
          expect(geo!.bodyOverflows, 'an overlong body must scroll rather than push the footer').toBe(
            true,
          );
        }
      });
    }
  }
});
