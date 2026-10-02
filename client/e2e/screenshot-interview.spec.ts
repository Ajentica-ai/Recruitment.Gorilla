import { test } from '@playwright/test';
import { ADMIN, shotPath } from './helpers';

/** Which interview to photograph. Without one there is nothing to capture. */
const interviewId = process.env.E2E_INTERVIEW_ID;

test('capture interview page live', async ({ page }) => {
  test.skip(!ADMIN.password, 'Set E2E_ADMIN_PASSWORD or DEMO_PASSWORD.');
  test.skip(
    !interviewId,
    'Set E2E_INTERVIEW_ID to an interview the account can open; none configured.',
  );

  // Relative, so PLAYWRIGHT_TEST_BASE_URL still decides where this points.
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', ADMIN.email!);
  await page.fill('input[type="password"]', ADMIN.password!);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Go to interviews 1
  await page.goto(`/interviews/${interviewId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Set dark theme attribute
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
  });
  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({
    path: shotPath('interview_studio_live_dark.png'),
    fullPage: true,
  });
});
