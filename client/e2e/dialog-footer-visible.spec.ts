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
 * #85 moved this spec's original subjects, the rubric and job opening editors,
 * onto the drawer primitive; `drawer-forms.spec.ts` guards them there. What is
 * left under Configuration is the option chip editor, which is short enough to
 * clear the fold on its own, so geometry alone would pass even with the bug
 * reintroduced. Hence the second assertion: the form wrapper must compute to
 * `display: contents`. That is the actual contract, and it fails the moment
 * someone drops the class, regardless of how tall the form happens to be.
 *
 * Needs no candidate and writes nothing: it opens an edit form and closes it.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD;

/** The form dialogs still reachable under Configuration after #85. */
const DIALOGS = [
  { name: 'skill editor', tab: 'skills', open: /^Edit / },
  { name: 'interview type editor', tab: 'interview-types', open: /^Edit / },
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
          // Whatever sits between DialogContent and DialogBody must not take
          // part in layout, or the body stops being the flex child that scrolls.
          const wrapper = body.parentElement;
          const content = pick('dialog-content');
          return {
            viewportBottom: window.innerHeight,
            footerBottom: Math.round(footer.getBoundingClientRect().bottom),
            bodyOverflows: body.scrollHeight > body.clientHeight + 1,
            bodyClientHeight: body.clientHeight,
            bodyScrollHeight: body.scrollHeight,
            wrapperTag: wrapper ? wrapper.tagName.toLowerCase() : null,
            wrapperDisplay: wrapper ? getComputedStyle(wrapper).display : null,
            bodyIsDirectChild: wrapper === content,
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

        // The contract itself, which short forms would otherwise satisfy by
        // accident: the body is either a direct child of the content box, or
        // whatever wraps it is out of the layout via `display: contents`.
        if (!geo!.bodyIsDirectChild) {
          expect(
            geo!.wrapperDisplay,
            `a <${geo!.wrapperTag}> between the content box and the body must be display:contents, ` +
              'otherwise the body stops scrolling and the footer leaves the viewport',
          ).toBe('contents');
        }
      });
    }
  }
});
