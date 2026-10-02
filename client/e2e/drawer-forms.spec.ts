import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { seedCandidate } from './seed';

/**
 * Guards the four forms moved from Dialog to Sheet in #85: add status, draft
 * offer, the rubric editor and the job opening editor.
 *
 * Two properties per form, both geometric so they describe what the user sees
 * rather than which classes happen to be applied:
 *
 *  - On a phone it is a bottom sheet: full width, anchored to the bottom, and
 *    NOT full height. Height is the discriminator, since a centred dialog sits
 *    away from both edges and the old right-hand panel ran the full height.
 *  - At every width the footer is reachable. That is the #81 property carried
 *    over: these forms wrap header/body/footer in a `<form>`, which only keeps
 *    its scroll contract because of `className="contents"`. Drop that and Save
 *    goes back under the fold, on the drawer exactly as it did on the dialog.
 *
 * Add status and draft offer are candidate-scoped and the repo ships no
 * fixtures, so one candidate is seeded through the API and deleted in `finally`.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD;

const PHONE = { name: 'phone', width: 390, height: 844 };
const SHORT_LAPTOP = { name: 'short laptop', width: 1279, height: 634 };

type Form = {
  name: string;
  /** Built per run because two of these hang off a seeded candidate id. */
  path: (candidateId: number) => string;
  trigger: RegExp;
  /** Offscreen on a phone until scrolled to. */
  scroll?: boolean;
};

const FORMS: Form[] = [
  { name: 'add status', path: (id) => `/candidates/${id}`, trigger: /^Add status$/ },
  { name: 'draft offer', path: (id) => `/candidates/${id}`, trigger: /Draft Offer|New Version/, scroll: true },
  { name: 'rubric editor', path: () => '/configuration?tab=rubrics', trigger: /Add rubric scorecard/i },
  { name: 'job opening editor', path: () => '/configuration?tab=jobs', trigger: /Add job opening/i },
];

async function authHeader(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

async function signIn(page: Page) {
  // Sign in wide: the nav collapses behind a hamburger at phone width.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Configuration' }).first()).toBeVisible();
}

/** Open a form and return its panel once the enter animation has settled. */
async function openForm(page: Page, form: Form, candidateId: number) {
  await page.goto(form.path(candidateId));
  const trigger = page.getByRole('button', { name: form.trigger }).first();
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  if (form.scroll) await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const panel = page.locator('[data-slot="sheet-content"]');
  await expect(panel).toBeVisible();
  // A rect read on the first frame is off by the slide distance, which would
  // shift every number below by a constant.
  await panel.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  return panel;
}

test.describe('converted form drawers', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an Admin, for Configuration).',
  );

  for (const vp of [PHONE, SHORT_LAPTOP]) {
    test(`all four are usable at ${vp.name} (${vp.width}x${vp.height})`, async ({ page, request }) => {
      test.setTimeout(120_000);
      const auth = await authHeader(request);
      const candidateId = await seedCandidate(request, auth, 'RG85 Form Probe');

      try {
        await signIn(page);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        for (const form of FORMS) {
          await openForm(page, form, candidateId);

          const geo = await page.evaluate(() => {
            const pick = (slot: string) =>
              document.querySelector(`[data-slot="${slot}"]`) as HTMLElement | null;
            const panel = pick('sheet-content');
            const footer = pick('sheet-footer');
            if (!panel) return null;
            const p = panel.getBoundingClientRect();
            return {
              vh: window.innerHeight,
              vw: window.innerWidth,
              top: Math.round(p.top),
              bottom: Math.round(p.bottom),
              width: Math.round(p.width),
              height: Math.round(p.height),
              footerBottom: footer ? Math.round(footer.getBoundingClientRect().bottom) : null,
            };
          });

          expect(geo, `${form.name}: no sheet panel found`).not.toBeNull();
          const where = `${form.name} at ${vp.name}`;

          // The footer holds Save. It must be on screen, whatever the width.
          expect(geo!.footerBottom, `${where}: form has no footer`).not.toBeNull();
          expect(
            geo!.footerBottom!,
            `${where}: footer bottom ${geo!.footerBottom}px must be within the ${geo!.vh}px viewport`,
          ).toBeLessThanOrEqual(geo!.vh + 1);

          if (vp.name === 'phone') {
            expect(geo!.width, `${where}: should span the full width`).toBe(geo!.vw);
            expect(geo!.bottom, `${where}: should be anchored to the bottom`).toBeGreaterThanOrEqual(
              geo!.vh - 1,
            );
            expect(geo!.top, `${where}: a bottom sheet must not start at the top edge`).toBeGreaterThan(0);
            expect(
              geo!.height,
              `${where}: should be capped near 92dvh rather than filling the screen`,
            ).toBeLessThanOrEqual(Math.round(geo!.vh * 0.93));
          } else {
            expect(geo!.height, `${where}: should be a full-height panel`).toBe(geo!.vh);
            expect(geo!.width, `${where}: should not span the whole width`).toBeLessThan(geo!.vw);
          }

          await page.keyboard.press('Escape');
          await page.waitForTimeout(350);
        }
      } finally {
        await request.delete(`/api/candidates/${candidateId}`, { headers: auth }).catch(() => {});
      }
    });
  }

  /**
   * The one piece of this change that is not a rename. "Advance Stage" lives
   * inside the status-history drawer and has to close it, because two stacked
   * panels is a poor shape on a phone. So the history drawer is put back when
   * the status drawer closes, and the reader keeps their place in the timeline.
   *
   * The same form is also reachable from the page header, where no drawer was
   * open and none should appear on close. That asymmetry is the whole reason
   * this is a flag rather than an unconditional reopen, so both paths are
   * checked.
   */
  test('the history drawer returns only when the status form came from it', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const auth = await authHeader(request);
    const candidateId = await seedCandidate(request, auth, 'RG85 Form Probe');

    const historyTitle = page.getByRole('heading', { name: /Status History/i });
    const statusTitle = page.getByRole('heading', { name: /Add a status|Advance Status/i });

    try {
      await signIn(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/candidates/${candidateId}`);

      // --- opened from inside the history drawer: it comes back ---
      await page.getByRole('button', { name: /Status history/ }).first().click();
      await expect(historyTitle).toBeVisible();

      await page.getByRole('button', { name: /Advance Stage/i }).click();
      await expect(statusTitle).toBeVisible();
      await expect(historyTitle, 'history should step aside, not stack').toBeHidden();

      await page.keyboard.press('Escape');
      await expect(historyTitle, 'history should return after a cancel').toBeVisible();

      await page.keyboard.press('Escape');
      await expect(historyTitle).toBeHidden();

      // --- opened from the page header: nothing should appear ---
      await page.getByRole('button', { name: /^Add status$/ }).first().click();
      await expect(statusTitle).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(statusTitle).toBeHidden();
      await expect(
        historyTitle,
        'history was never open, so it must not appear on close',
      ).toBeHidden();
    } finally {
      await request.delete(`/api/candidates/${candidateId}`, { headers: auth }).catch(() => {});
    }
  });
});
