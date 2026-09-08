import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL ?? 'admin@recruitmentgorilla.com';
const password = process.env.E2E_PASSWORD ?? 'admin';

test.describe('Analytics & Real-time Bulk Upload E2E (Issues #20 & #19)', () => {
  test('login → analytics dashboard → presets & charts → upload queue', async ({ page }) => {
    // 1. Log in
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[name="email"]');
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // 2. Navigate to Analytics page
    const analyticsLink = page.getByRole('link', { name: 'Analytics' }).first();
    await expect(analyticsLink).toBeVisible();
    await analyticsLink.click();
    await expect(page).toHaveURL(/\/analytics$/);

    // 3. Verify KPI cards
    await expect(page.getByRole('heading', { name: 'Avg Time to Hire' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pipeline Velocity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Funnel Conversion Rate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Pipeline' })).toBeVisible();

    // 4. Verify Preset controls & click 90 Days
    const preset90d = page.getByRole('button', { name: '90 Days' });
    await expect(preset90d).toBeVisible();
    await preset90d.click();
    await expect(preset90d).toHaveClass(/active/);

    // 5. Verify Stepped Funnel and Sourcing ROI table
    await expect(page.getByRole('heading', { name: 'Pipeline Funnel & Conversion' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sourcing Channel Performance & ROI' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recruiter Productivity & Pipeline Workload' })).toBeVisible();

    // Screenshot polished analytics dashboard
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/analytics_polished_dashboard.png',
      fullPage: true,
    });

    // 6. Navigate to Candidate #1 detail page to verify clean timeline & status
    await page.goto('/candidates/1');
    await expect(page.getByRole('heading', { name: 'Md Rifat Hossen' })).toBeVisible();
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/02_candidate_detail_cleaned.png',
      fullPage: true,
    });

    // 7. Navigate to Upload CVs page (Issue #19)
    const uploadLink = page.getByRole('link', { name: 'Upload CVs' }).first();
    await expect(uploadLink).toBeVisible();
    await uploadLink.click();
    await expect(page).toHaveURL(/\/upload$/);

    // 8. Verify Dropzone & background parser instructions
    await expect(page.getByText(/Drag & drop CVs here, or click to browse/i)).toBeVisible();
    await expect(page.getByText(/PDF or Word \(\.docx\)/i)).toBeVisible();
  });
});
