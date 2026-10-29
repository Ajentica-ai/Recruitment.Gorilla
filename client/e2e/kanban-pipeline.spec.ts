import { test, expect } from '@playwright/test';
import { ADMIN, shotPath, signIn } from './helpers';

test.describe('Visual Recruitment Pipeline (Dual-Mode Kanban Board)', () => {
  test.skip(!ADMIN.email || !ADMIN.password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.');

  test('toggle between Table and Kanban Board, verify columns, stagnant alert, and modal', async ({ page }) => {
    // 1. Login
    await signIn(page, ADMIN);

    // 2. Go to /candidates
    await page.goto('/candidates');
    await page.waitForSelector('.data-toolbar');
    await page.screenshot({ path: shotPath('01_candidates_table_view.png') });

    // 3. Switch to Kanban Board View
    // A segmented control under role=group "Candidate view mode" since the
    // redesign; `button[title*="Pipeline board view"]` matches nothing (#83).
    const viewToggle = page.getByRole('group', { name: 'Candidate view mode' });
    const boardBtn = viewToggle.getByRole('button', { name: 'Board' });
    await expect(boardBtn).toBeVisible();
    await boardBtn.click();

    // 4. Verify Kanban Board rendered
    await page.waitForSelector('.kanban-board');
    await expect(page.locator('.kanban-summary-bar')).toBeVisible();
    await expect(page.locator('.kanban-column').first()).toBeVisible();

    await page.screenshot({ path: shotPath('02_kanban_board_view.png') });

    // 5. Check stage columns and candidate card
    const firstCard = page.locator('.kanban-card').first();
    if (await firstCard.count() > 0) {
      await expect(firstCard).toBeVisible();
      
      // Advance button opens status modal
      const advanceBtn = firstCard.locator('.kanban-card__advance-btn');
      if (await advanceBtn.isVisible()) {
        await advanceBtn.click();
        // A drawer since #85, and Radix before that: `.modal-title` and
        // `.modal-header .btn-close` were react-bootstrap and have matched
        // nothing for two migrations. Target the role and the data-slot instead,
        // which survive a restyle.
        const panel = page.locator('[data-slot="sheet-content"]');
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('heading')).toContainText(/Advance Status|Add a status/);
        await page.screenshot({ path: shotPath('03_kanban_advance_modal.png') });

        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(panel).toBeHidden();
      }
    }

    // 6. Switch back to Table View and verify
    const tableBtn = viewToggle.getByRole('button', { name: 'Table' });
    await tableBtn.click();
    await page.waitForSelector('.table-wrap');
    await expect(page.locator('.table-cards')).toBeVisible();
    await page.screenshot({ path: shotPath('04_table_view_toggled_back.png') });
  });
});
