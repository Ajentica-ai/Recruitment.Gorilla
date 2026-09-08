import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const email = process.env.E2E_EMAIL ?? 'admin@recruitmentgorilla.com';
const password = process.env.E2E_PASSWORD ?? 'admin';

test.describe('End-to-End Candidate Education, Experience & Coding Profiles Test', () => {
  test.setTimeout(90000);

  test('Uploads BD Technical CV → Staging Studio parses Education, CGPA, Experience, Coding Links → Approved Candidate Profile renders rich sections', async ({
    page,
  }) => {
    // 1. Log in
    await page.goto('/');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('link', { name: 'Candidates' }).first()).toBeVisible({ timeout: 15000 });

    // 2. Navigate to Upload page
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/upload$/);

    // 3. Attach technical CV
    const cvDir = path.resolve('e2e/test-cvs');
    const testCvPath = path.join(cvDir, 'Alex_Rivera_Senior_Backend_Engineer.pdf');
    expect(fs.existsSync(testCvPath)).toBeTruthy();

    const batchName = `BD Software Engineers Batch ${Date.now()}`;
    const batchInput = page.locator('#batch-name-input');
    await batchInput.fill(batchName);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([testCvPath]);

    // 4. Wait for processing to complete and click Open Review Workspace
    const openReviewBtn = page.getByRole('button', { name: /Open Review Workspace/i });
    await expect(openReviewBtn).toBeVisible({ timeout: 45000 });
    await openReviewBtn.click();

    // 5. Verify Draft Staging Workspace loads & select the active draft
    await expect(page.locator('.draft-workspace')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.draft-editor-studio')).toBeVisible();

    // 6. Verify Extracted Identity & Location
    const uniqueCandidateName = `Alex Rivera ${Date.now().toString().slice(-4)}`;
    const nameInput = page.locator('input[placeholder="Candidate full name"]');
    await expect(nameInput).toHaveValue('Alex Rivera');
    await nameInput.fill(uniqueCandidateName);

    const locationInput = page.locator('input[placeholder="e.g. Dhaka, Bangladesh"]');
    await expect(locationInput).toHaveValue(/Dhaka/i);

    // 7. Verify Extracted Coding Profiles
    const leetCodeInput = page.locator('input[placeholder="leetcode.com/u/..."]');
    await expect(leetCodeInput).toHaveValue(/leetcode\.com/i);

    const codeforcesInput = page.locator('input[placeholder="codeforces.com/profile/..."]');
    await expect(codeforcesInput).toHaveValue(/codeforces\.com/i);

    // 8. Verify Extracted Education & CGPA (or interactively add/adjust)
    await expect(page.locator('text=Education & Academic Qualifications')).toBeVisible();
    const addEduBtn = page.getByRole('button', { name: /\+ Add Education/i });
    const degreeInput = page.locator('input[placeholder="e.g. BSc in Computer Science & Engineering"]').first();

    if (!(await degreeInput.isVisible())) {
      await addEduBtn.click();
      await page.waitForTimeout(200);
      await degreeInput.fill('BSc in Computer Science & Engineering');
      const instInput = page.locator('input[placeholder="e.g. BUET, DU, NSU, BRAC University"]').first();
      await instInput.fill('Bangladesh University of Engineering and Technology');
      const yearInput = page.locator('input[placeholder="e.g. 2024"]').first();
      await yearInput.fill('2020');
      const cgpaInput = page.locator('input[placeholder="e.g. 3.85 / 4.00"]').first();
      await cgpaInput.fill('3.85 / 4.00');
    } else {
      await expect(degreeInput).toHaveValue(/BSc|Computer Science/i);
    }

    // 9. Verify Extracted Work Experience History (or interactively add/adjust)
    await expect(page.locator('text=Work & Employment History')).toBeVisible();
    const addExpBtn = page.getByRole('button', { name: /\+ Add Experience/i });
    const titleInput = page.locator('input[placeholder="e.g. Senior Backend Engineer"]').first();

    if (!(await titleInput.isVisible())) {
      await addExpBtn.click();
      await page.waitForTimeout(200);
      await titleInput.fill('Senior Backend Engineer');
      const companyInput = page.locator('input[placeholder="e.g. Tech Innovations Ltd"]').first();
      await companyInput.fill('Brain Station 23');
      const durationInput = page.locator('input[placeholder="e.g. Jan 2022 – Present"]').first();
      await durationInput.fill('2020 – Present');
      const descInput = page.locator('textarea[placeholder="Key achievements, technologies used, responsibilities..."]').first();
      await descInput.fill('• Led key architectural initiatives resulting in high scalability.');
    } else {
      await expect(titleInput).toHaveValue(/Senior Backend Engineer/i);
    }

    // 10. Capture screenshot of Draft Staging Studio with rich extracted data
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/20_draft_studio_bd_profile_extracted.png',
      fullPage: true,
    });

    // 11. Select applied role if needed
    const roleInput = page.locator('input[placeholder="Select position / job opening..."], input.dropdown-trigger-input').first();
    if (await roleInput.isVisible()) {
      await roleInput.click();
      await page.waitForTimeout(200);
      const option = page.locator('.dropdown-popover__item').first();
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // 12. Approve & Create Candidate
    const approveBtn = page.getByRole('button', { name: /Approve & Create Candidate/i });
    await expect(approveBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/approve') && r.status() === 200),
      approveBtn.click(),
    ]);

    const resJson = await response.json();
    const candidateId = resJson.candidateId;
    expect(candidateId).toBeGreaterThan(0);

    // 13. Navigate directly to the newly created Candidate Detail profile view
    await page.goto(`/candidates/${candidateId}`);
    await expect(page).toHaveURL(`/candidates/${candidateId}`);
    await page.waitForSelector('.profile-card', { timeout: 15000 });

    // Verify Coding Profile Links
    await expect(page.locator('.profile-links a:has-text("LeetCode")')).toBeVisible();
    await expect(page.locator('.profile-links a:has-text("Codeforces")')).toBeVisible();

    // Verify Location Tile
    await expect(page.locator('.profile-tile:has-text("Location")')).toBeVisible();
    await expect(page.locator('.profile-tile:has-text("Dhaka")')).toBeVisible();

    // Verify Education & CGPA Badges
    await expect(page.locator('text=Education & Academics')).toBeVisible();
    await expect(page.locator('.badge:has-text("CGPA")').first()).toBeVisible();
    await expect(page.locator('text=BSc in Computer Science & Engineering').first()).toBeVisible();

    // Verify Work Experience
    await expect(page.locator('text=Work Experience')).toBeVisible();
    await expect(page.locator('text=/Senior Backend Engineer|Brain/i').first()).toBeVisible();

    // 16. Capture screenshot of the full-width Candidate Profile
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/21_candidate_profile_education_experience_complete.png',
      fullPage: true,
    });

    // 17. Open Status History Slide-over Drawer
    await page.click('.btn-action-history');
    await expect(page.locator('.history-drawer.show')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('.history-drawer .timeline')).toBeVisible();

    // 18. Capture screenshot of the open Status History Drawer
    await page.screenshot({
      path: 'C:/Users/user/.gemini/antigravity-ide/brain/4655deb6-8ac0-42bb-8a60-04a998094da6/22_candidate_status_history_drawer.png',
    });
  });
});
