import { test, expect } from '@playwright/test';

test('Screenshot All Tab', async ({ page }) => {
  await page.goto('http://localhost:5173/upload');
  await page.waitForLoadState('networkidle');
  await page.locator('button:has-text("Review Staging Workspace")').click();
  await page.waitForSelector('.draft-list-rail__body');
  
  // Click the 'All' tab
  await page.locator('button:has-text("All")').click();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/19_all_tab_screenshot.png',
    fullPage: true,
  });
});
