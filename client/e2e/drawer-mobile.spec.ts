import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

/**
 * Regression guard for #84: a drawer is a bottom sheet on a phone and a
 * right-hand panel from `sm` up.
 *
 * `SheetContent` used to be a flat `w-[min(28rem,100vw)]` right-hand panel at
 * every width. On a phone that is a full-height, full-width surface entering
 * horizontally, which reads as a page navigation rather than an overlay, so
 * people reach for the browser back button and it does not dismiss.
 *
 * Asserted geometrically, not by class name, so the check survives a styling
 * refactor and actually describes what the user sees. The discriminator is
 * height: the old panel was full-height on a phone, a bottom sheet is not.
 *
 * All three drawers are candidate-scoped, and the repo ships no candidate
 * fixtures, so this seeds one through the app's own API and deletes it again in
 * `finally`.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_PASSWORD;

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function authHeader(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).token}` };
}

/** A throwaway candidate, so the drawer has something to open against. */
async function seedCandidate(request: APIRequestContext, auth: Record<string, string>) {
  const initial = await (await request.get('/api/status-options/initial', { headers: auth })).json();
  const res = await request.post('/api/candidates', {
    headers: auth,
    data: {
      fullName: 'RG84 Drawer Probe',
      email: 'rg84.drawer.probe@example.invalid',
      relevantExperience: '5 years',
      isReferred: false,
      storedFileName: 'probe.pdf',
      originalFileName: 'probe.pdf',
      fileType: 'PDF',
      fileSizeBytes: 1024,
      initialStatus: initial[0].name,
      initialStatusComment: 'Seeded by e2e/drawer-mobile.spec.ts.',
      allowDuplicate: true,
    },
  });
  expect(res.ok(), `seed failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

async function signIn(page: Page) {
  // Sign in wide: the nav collapses behind a hamburger at phone width.
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'Candidates' }).first()).toBeVisible();
}

async function openHistoryDrawer(page: Page, candidateId: number) {
  await page.goto(`/candidates/${candidateId}`);
  await page.getByRole('button', { name: /Status history/ }).first().click();
  const panel = page.locator('[data-slot="sheet-content"]');
  await expect(panel).toBeVisible();
  // Let the enter animation finish. A first-frame rect read is off by the
  // slide distance, which silently shifts every number below.
  await panel.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  return panel;
}

test.describe('drawers are bottom sheets on a phone', () => {
  test.skip(
    !email || !password,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an Admin, so every candidate is in scope).',
  );

  test('status history drawer at 390x844 and 1280x800', async ({ page, request }) => {
    const auth = await authHeader(request);
    const candidateId = await seedCandidate(request, auth);

    try {
      await signIn(page);

      // --- phone: a bottom sheet ---
      await page.setViewportSize(PHONE);
      let panel = await openHistoryDrawer(page, candidateId);
      let box = (await panel.boundingBox())!;

      expect(Math.round(box.width), 'should span the full width of the phone').toBe(PHONE.width);
      expect(
        Math.round(box.y + box.height),
        'should be anchored to the bottom of the viewport',
      ).toBeGreaterThanOrEqual(PHONE.height - 1);
      // The discriminator: the old full-height panel started at y=0.
      expect(Math.round(box.y), 'a bottom sheet must not start at the top edge').toBeGreaterThan(0);
      expect(
        Math.round(box.height),
        'should be capped near 92dvh rather than filling the screen',
      ).toBeLessThanOrEqual(Math.round(PHONE.height * 0.93));

      await page.keyboard.press('Escape');

      // --- desktop: a right-hand panel ---
      await page.setViewportSize(DESKTOP);
      panel = await openHistoryDrawer(page, candidateId);
      box = (await panel.boundingBox())!;

      expect(
        Math.round(box.x + box.width),
        'should be anchored to the right edge',
      ).toBeGreaterThanOrEqual(DESKTOP.width - 1);
      expect(Math.round(box.height), 'should be a full-height panel').toBe(DESKTOP.height);
      expect(Math.round(box.width), 'should not span the whole desktop width').toBeLessThan(
        DESKTOP.width,
      );
    } finally {
      await request.delete(`/api/candidates/${candidateId}`, { headers: auth }).catch(() => {});
    }
  });
});
