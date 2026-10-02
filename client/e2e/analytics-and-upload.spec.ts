import { test, expect } from '@playwright/test';
import { apiAuth, candidateCount, requireData, shotPath } from './helpers';

const email = process.env.E2E_EMAIL ?? 'admin@recruitmentgorilla.com';
const password = process.env.E2E_PASSWORD ?? 'admin';

test.describe('Analytics & Real-time Bulk Upload E2E (Issues #20 & #19)', () => {
  test('login → analytics dashboard → presets & charts → upload queue', async ({ page, request }) => {
    // Every tile and chart on this page is derived from candidate rows, so
    // against an empty database the assertions describe missing data rather
    // than a broken page (#83).
    // Same identity the browser uses below: candidate visibility is
    // role-scoped, so probing as someone else proves nothing.
    const auth = await apiAuth(request, { email, password });
    requireData(
      (await candidateCount(request, auth)) > 0,
      'candidates for the analytics tiles and charts',
    );

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
    await expect(page.getByRole('heading', { name: 'Average time to hire' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pipeline Velocity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Funnel conversion' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active Pipeline' })).toBeVisible();

    // 4. Verify Preset controls & click 90 Days
    const preset90d = page.getByRole('button', { name: '90 Days' });
    await expect(preset90d).toBeVisible();
    await preset90d.click();
    await expect(preset90d).toHaveClass(/active/);

    // 5. Verify Stepped Funnel and Sourcing ROI table
    await expect(page.getByRole('heading', { name: 'Pipeline funnel' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sourcing Channel Performance & ROI' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recruiter Productivity & Pipeline Workload' })).toBeVisible();

    // Screenshot polished analytics dashboard
    await page.screenshot({
      path: shotPath('analytics_polished_dashboard.png'),
      fullPage: true,
    });

    // 6. Navigate to a candidate detail page to verify clean timeline & status.
    //    Was pinned to /candidates/1 and one person's name, which only existed in
    //    the database this spec was written against (#83).
    const first = await request.get('/api/candidates?page=1&pageSize=1', { headers: auth });
    const firstBody = await first.json();
    const candidate = (firstBody?.items ?? firstBody)?.[0];
    requireData(Boolean(candidate?.id), 'a candidate to open the detail page for');
    await page.goto(`/candidates/${candidate.id}`);
    await expect(page.getByRole('heading', { name: candidate.fullName })).toBeVisible();
    await page.screenshot({
      path: shotPath('02_candidate_detail_cleaned.png'),
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
