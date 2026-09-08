import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const email = process.env.E2E_EMAIL ?? 'admin@recruitmentgorilla.com';
const password = process.env.E2E_PASSWORD ?? 'admin';

test.describe('Bulk Upload 10 CVs & Staging Review Workspace Test', () => {
  test.setTimeout(60000);

  test('uploads 10 sample CVs → persists to MySQL → reviews in Staging Workspace', async ({ page }) => {
    // 1. Log in
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[name="email"]');
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Upload CVs page
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/upload$/);

    // 3. Provide batch label
    const batchInput = page.locator('#batch-name-input');
    await batchInput.fill('Q3 Senior Engineering Intake');

    // 4. Attach 10 CV files
    const cvDir = path.resolve('e2e/test-cvs');
    const fileNames = fs.readdirSync(cvDir).filter((f) => f.endsWith('.pdf'));
    expect(fileNames.length).toBe(10);
    const filePaths = fileNames.map((f) => path.join(cvDir, f));

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePaths);

    // 5. Wait for all 10 files to complete upload & MySQL staging
    await expect(page.getByRole('button', { name: /Open Review Workspace/i })).toBeVisible({ timeout: 45000 });

    // 6. Screenshot upload completion banner
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/13_upload_completed_banner.png',
      fullPage: true,
    });

    // 7. Click to open Review Workspace
    await page.getByRole('button', { name: /Open Review Workspace/i }).click();
    await expect(page.locator('.draft-workspace')).toBeVisible({ timeout: 10000 });

    // 8. Screenshot Staging Review Studio with 10 pending drafts    // 8a. Capture light mode review studio
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/14_draft_staging_studio_split_view.png',
      fullPage: true,
    });

    // 8b. Click All tab and capture screenshot
    await page.locator('button:has-text("All")').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/19_all_tab_screenshot.png',
      fullPage: true,
    });
    // Click Pending tab back
    await page.getByRole('button', { name: /^Pending \d+$/ }).click();

    // 8c. Capture dark mode review studio
    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'dark'));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/17_draft_staging_studio_dark_mode.png',
      fullPage: true,
    });

    // 8c. Scroll studio body and capture Experience & Skills section
    await page.locator('.draft-editor-studio__body').evaluate((el) => {
      el.scrollTop = 250;
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/18_draft_studio_experience_scrolled.png',
      fullPage: true,
    });
    // Switch back to light mode
    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'light'));

    // 9. Verify first draft is loaded in Studio
    await expect(page.locator('.draft-editor-studio__head')).toBeVisible();

    // Select role if not pre-selected
    const roleSelect = page.locator('.draft-editor-studio .dropdown-trigger');
    if (await roleSelect.isVisible()) {
      await roleSelect.first().click();
      const firstRoleOption = page.locator('.dropdown-popover__item').first();
      if (await firstRoleOption.isVisible()) {
        await firstRoleOption.click();
      }
    }

    // 10. Click "Approve & Create Candidate"
    const approveBtn = page.getByRole('button', { name: /Approve & Create Candidate/i });
    await approveBtn.click();

    // Verify toast appears
    await expect(page.getByText(/Successfully created candidate/i)).toBeVisible({ timeout: 10000 });

    // 11. Screenshot studio after approving candidate #1 and advancing to candidate #2
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/15_draft_studio_advanced_to_next.png',
      fullPage: true,
    });

    // 12. Test "Discard Draft" on candidate #2
    const discardBtn = page.getByRole('button', { name: /Discard Draft/i });
    await discardBtn.click();
    await expect(page.getByText(/marked as discarded/i)).toBeVisible({ timeout: 10000 });

    // 13. Navigate to Candidates page to confirm candidate is persisted
    await page.goto('/candidates');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/16_candidates_page_with_staged_approvals.png',
      fullPage: true,
    });
  });
});
