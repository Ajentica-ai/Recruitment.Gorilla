import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ADMIN, apiAuth, freshTestCvs, requireData, signIn } from './helpers';

// JSON import is Admin and Super Admin only. SUPERADMIN_* come from e2e/.env.e2e; see .env.e2e.example.
const SUPER_ADMIN = { email: process.env.SUPERADMIN_EMAIL, password: process.env.SUPERADMIN_PASSWORD };

test.describe('JSON candidate import', () => {
  test.setTimeout(60000);

  test('a Super Admin downloads the template, fills it, and imports two candidates as drafts', async ({ page, request }) => {
    requireData(Boolean(SUPER_ADMIN.email && SUPER_ADMIN.password), 'SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD');
    const cvs = freshTestCvs().slice(0, 2);
    requireData(cvs.length === 2, '2 freshly generated test CVs');
    const auth = await apiAuth(request, SUPER_ADMIN);
    const roles = await (await request.get('/api/candidates/role-options', { headers: auth })).json();
    requireData(Array.isArray(roles) && roles.length > 0, 'an open job opening');

    await signIn(page, SUPER_ADMIN);
    await page.goto('/upload');
    await page.getByRole('radio', { name: /JSON \+ CVs/ }).click();

    // The template: instructions in comments, and a sample entry to copy.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download JSON template/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('candidate-import-template.json');
    const template = fs.readFileSync(await download.path(), 'utf8');
    expect(template).toContain('MANDATORY FIELDS');

    // Keep the template's comment header, as an AI assistant filling it in might.
    const header = template.slice(0, template.indexOf('*/') + 2);
    const tag = randomUUID().slice(0, 8);
    const entries = cvs.map((cvPath, i) => ({
      cvFileName: path.basename(cvPath),
      fullName: `Json Import ${i === 0 ? 'Alpha' : 'Beta'}`,
      email: `json-import-${tag}-${i}@example.com`,
      currentTitle: `Imported Title ${tag}`,
      skills: ['TypeScript', 'SQL'],
    }));
    const manifestPath = path.join(path.dirname(cvs[0]), 'candidates.json');
    fs.writeFileSync(manifestPath, `${header}\n${JSON.stringify({ candidates: entries }, null, 2)}\n`);

    await page.locator('#json-batch-name-input').fill(`JSON import ${tag}`);
    await page.locator('#json-job-role-select').selectOption({ index: 1 });
    await page.locator('input[type="file"]').setInputFiles([manifestPath, ...cvs]);

    const table = page.getByRole('table', { name: /Import pre-check/i });
    await expect(table.getByText('Json Import Alpha')).toBeVisible();
    await expect(table.getByText('Json Import Beta')).toBeVisible();

    await page.getByRole('button', { name: 'Import 2 candidates' }).click();
    await expect(page.getByRole('button', { name: /Open Review Workspace/i })).toBeVisible({ timeout: 30000 });
    await expect(table.getByText('Staged')).toHaveCount(2);

    // The drafts carry the JSON values, not whatever the parser would have read from the PDFs.
    await page.getByRole('button', { name: /Open Review Workspace/i }).click();
    await expect(page.locator('.draft-workspace')).toBeVisible();
    await expect(page.getByText('Json Import Alpha').first()).toBeVisible();
    await expect(page.getByText('Json Import Beta').first()).toBeVisible();
  });

  test('an Admin gets the JSON import option too', async ({ page }) => {
    requireData(Boolean(ADMIN.email && ADMIN.password), 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD');
    await signIn(page, ADMIN);
    await page.goto('/upload');
    await expect(page.getByRole('radio', { name: /JSON \+ CVs/ })).toBeVisible();
    await page.getByRole('radio', { name: /JSON \+ CVs/ }).click();
    await expect(page.getByRole('button', { name: /Download JSON template/i })).toBeVisible();
  });
});
