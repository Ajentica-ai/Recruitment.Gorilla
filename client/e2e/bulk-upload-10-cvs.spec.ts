import { test, expect } from '@playwright/test';
import { ADMIN, ensureTestCvs, requireData, shotPath } from './helpers';

// Admin, not E2E_EMAIL's Recruiter: approving a draft requires assigning an
// applied role, and a Recruiter only sees roles they are assigned to. With none,
// the studio blocks the approval and this flow cannot complete (#83).
const email = ADMIN.email ?? process.env.E2E_EMAIL;
const password = ADMIN.password ?? process.env.E2E_PASSWORD;

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

    // 4. Attach 10 CV files. The fixtures are generated rather than committed,
    //    so ask for them instead of asserting they were left behind (#83).
    const available = ensureTestCvs();
    requireData(available.length >= 10, '10 generated test CVs in e2e/test-cvs');
    const filePaths = available.slice(0, 10);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePaths);

    // 5. Wait for all 10 files to complete upload & MySQL staging
    await expect(page.getByRole('button', { name: /Open Review Workspace/i })).toBeVisible({ timeout: 45000 });

    // 6. Screenshot upload completion banner
    await page.screenshot({
      path: shotPath('13_upload_completed_banner.png'),
      fullPage: true,
    });

    // 7. Click to open Review Workspace
    await page.getByRole('button', { name: /Open Review Workspace/i }).click();
    await expect(page.locator('.draft-workspace')).toBeVisible({ timeout: 10000 });

    // 8. Screenshot Staging Review Studio with 10 pending drafts    // 8a. Capture light mode review studio
    await page.waitForTimeout(300);
    await page.screenshot({
      path: shotPath('14_draft_staging_studio_split_view.png'),
      fullPage: true,
    });

    // 8b. There is no "All" tab to screenshot. The workspace filter offers
    //     Pending, Approved and Discarded only, and DraftReviewWorkspace says so
    //     outright: "There is no 'all statuses' view here". The step that clicked
    //     it is gone rather than retargeted, since at this point in the run every
    //     draft is Pending and the other two tabs are empty (#83).
    // Click Pending tab back
    // The status filter is a Radix single ToggleGroup: its items are role=radio
    // rather than buttons, the count badge sits flush against the label (the
    // text reads "Pending42", no space), and the group wrapper is not in the
    // accessibility tree at all, so getByRole('group') finds nothing. Matching
    // on the item's own text is the one form that holds (#83).
    await page.locator('[role="radio"]').filter({ hasText: /^Pending/ }).click();

    // 8c. Capture dark mode review studio
    await page.evaluate(() => document.documentElement.setAttribute('data-bs-theme', 'dark'));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: shotPath('17_draft_staging_studio_dark_mode.png'),
      fullPage: true,
    });

    // 8c. Scroll studio body and capture Experience & Skills section
    await page.locator('.draft-editor-studio__body').evaluate((el) => {
      el.scrollTop = 250;
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: shotPath('18_draft_studio_experience_scrolled.png'),
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
    await expect(
      page.getByText(/Successfully created candidate/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // 11. Screenshot studio after approving candidate #1 and advancing to candidate #2
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: shotPath('15_draft_studio_advanced_to_next.png'),
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
      path: shotPath('16_candidates_page_with_staged_approvals.png'),
      fullPage: true,
    });
  });
});
