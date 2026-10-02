import { test, expect } from '@playwright/test';
import * as path from 'node:path';
import { apiAuth, candidateCount, requireData, shotDir } from './helpers';

const email = process.env.E2E_EMAIL || 'admin@recruitmentgorilla.com';
const password = process.env.E2E_PASSWORD || 'admin';
const screenshotDir = shotDir();

test.describe('Offer Management End-to-End Test', () => {
  test('Complete Offer Lifecycle Flow', async ({ page, request }) => {
    // Same identity the browser signs in with, since candidate access is
    // role-scoped.
    const auth = await apiAuth(request, { email, password });
    requireData(
      (await candidateCount(request, auth)) > 0,
      'at least one candidate to draft an offer against',
    );

    // 1. Navigate to home & login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (await page.locator('input[type="email"]').isVisible()) {
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
    }

    // 2. Wait for Nav Candidates link to become visible (confirms successful login)
    const candidatesLink = page.getByRole('link', { name: 'Candidates' }).first();
    await expect(candidatesLink).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '01_dashboard.png'), fullPage: true });

    // 3. Navigate to Candidates page
    await candidatesLink.click();
    await expect(page).toHaveURL(/\/candidates$/);
    await page.waitForTimeout(1000);

    // 4. Open the first candidate detail (or click first candidate link)
    const firstCandidateLink = page.locator('a[href^="/candidates/"]').first();
    if (await firstCandidateLink.count() > 0) {
      await firstCandidateLink.click();
      await expect(page).toHaveURL(/\/candidates\/\d+/);
      await page.waitForTimeout(1000);

      // Take screenshot of Candidate Detail with Offer card
      await page.screenshot({ path: path.join(screenshotDir, '02_candidate_detail.png'), fullPage: true });

      // 5. Check for Offer & Compensation section
      const offerSection = page.getByText(/Offer & Compensation/i);
      await expect(offerSection).toBeVisible();

      // 6. If "Draft Offer" or "New Version" button exists, click it
      const draftBtn = page.getByRole('button', { name: /Draft Offer|New Version/i });
      if (await draftBtn.isVisible()) {
        await draftBtn.click();
        await page.waitForTimeout(500);

        // Fill modal form
        await page.locator('input[placeholder="120000"]').fill('145000');
        await page.locator('input[placeholder="e.g. 15000"]').fill('20000');
        await page.locator('input[placeholder*="RSUs"]').fill('10,000 Stock Options');
        await page.locator('textarea[placeholder*="benefits package"]').fill('Comprehensive health & dental, 401(k) 5% match, 4 weeks PTO.');

        await page.screenshot({ path: path.join(screenshotDir, '03_draft_offer_modal.png') });

        // Submit offer
        await page.getByRole('button', { name: /Create Offer|Save Changes/i }).click();
        await page.waitForTimeout(1500);

        await page.screenshot({ path: path.join(screenshotDir, '04_offer_created_card.png') });

        // Verify offer details rendered
        await expect(page.getByText('145,000.00').first()).toBeVisible();

        // 7. Test Extend Offer button if available
        const extendBtn = page.getByRole('button', { name: /Extend Offer/i }).first();
        if (await extendBtn.isVisible()) {
          await extendBtn.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(screenshotDir, '05_offer_extended.png') });
        }

        // 8. Test Record Candidate Decision if available
        const decisionBtn = page.getByRole('button', { name: /Record Candidate Decision/i });
        if (await decisionBtn.isVisible()) {
          await decisionBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(screenshotDir, '06_decision_modal.png') });

          // Confirm acceptance
          await page.getByRole('button', { name: /Confirm Accepted/i }).click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(screenshotDir, '07_offer_accepted.png') });
        }
      }

      // 9. Go back to Dashboard to inspect updated Offer metrics
      const dashboardLink = page.getByRole('link', { name: /Dashboard/i }).first();
      await dashboardLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, '08_dashboard_with_metrics.png'), fullPage: true });
    }
  });
});
