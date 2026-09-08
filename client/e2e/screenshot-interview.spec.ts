import { test } from '@playwright/test';

test('capture interview page live', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"], input[name="email"]', 'admin@recruitmentgorilla.com');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Go to interviews 1
  await page.goto('http://localhost:5173/interviews/1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Set dark theme attribute
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
  });
  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({
    path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/interview_studio_live_dark.png',
    fullPage: true,
  });
});
