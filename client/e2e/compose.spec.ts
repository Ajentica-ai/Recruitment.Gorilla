import { expect, test } from '@playwright/test';

/**
 * Smoke test for the Docker Compose stack — NOT for the Vite dev server.
 *
 *   docker compose up -d --build
 *   npx playwright test e2e/compose.spec.ts
 *
 * It covers the things that only break once the app is behind nginx instead of
 * behind Vite's proxy: that /api and the SignalR hub are routed, that the SPA
 * fallback serves deep links, and that the refresh cookie survives — the last
 * of which fails silently, fifteen minutes after anyone would notice.
 */
const BASE = process.env.COMPOSE_BASE_URL ?? 'http://localhost:8090';

test('the composed stack serves the app, the API and the hub', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.fill('input[type="email"]', 'admin@recruitmentgorilla.com');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

  // The refresh token must actually have been stored. Under
  // ASPNETCORE_ENVIRONMENT=Production the cookie is marked Secure, which a
  // browser discards over plain http — sign-in still appears to work, and the
  // session then dies when the access token expires.
  const refresh = (await page.context().cookies()).find((c) => /refresh/i.test(c.name));
  expect(refresh, 'refresh cookie must be stored').toBeTruthy();
  expect(refresh!.httpOnly).toBe(true);

  // A data page, so the API is exercised through nginx and not only the login.
  await page.goto(`${BASE}/candidates`);
  await page.waitForSelector('.data-toolbar', { timeout: 30000 });

  // SignalR negotiate. A 404 here means either the hub is not mapped or /hubs
  // is not proxied with the WebSocket upgrade headers.
  await page.goto(`${BASE}/upload`);
  await page.waitForTimeout(4000);
  const hubErrors = errors.filter((e) => /negotiat|signalr/i.test(e));
  expect(hubErrors, `SignalR failed: ${hubErrors[0] ?? ''}`).toHaveLength(0);

  // nginx's SPA fallback, and the session surviving a full reload. Let the
  // first load finish its refresh exchange before reloading — firing reload()
  // into an in-flight bootstrap aborts that request and looks like a broken
  // session when it is only a race.
  await page.goto(`${BASE}/configuration`);
  await page.waitForSelector('main', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.reload();
  await page
    .waitForFunction(() => !location.pathname.includes('/login'), undefined, { timeout: 20000 })
    .catch(() => {});
  expect(page.url()).not.toContain('/login');
});
