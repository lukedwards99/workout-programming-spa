import { test, expect } from '@playwright/test';
import { clearDatabase, createProgramViaUI, viewProgram, addMesocycleViaUI } from './setup';

test.describe('Program Page — Mesocycles', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);
    await createProgramViaUI(page, 'Test Program', 'Program notes');
    await viewProgram(page, 'Test Program');
  });

  test('shows program name and notes on the page', async ({ page }) => {
    await expect(page.locator('.page-header h1')).toHaveText('Test Program');
    await expect(page.locator('.page-notes, p').first()).toContainText('Program notes');
  });

  test('shows breadcrumb with program name', async ({ page }) => {
    await expect(page.locator('.breadcrumb')).toContainText('Programs');
    await expect(page.locator('.breadcrumb')).toContainText('Test Program');
  });

  test('shows empty message when no mesocycles', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state p')).toHaveText(/No mesocycles yet/);
  });

  test('adds a mesocycle via inline form', async ({ page }) => {
    await addMesocycleViaUI(page, 'Strength Block', 5);

    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody td').first()).toContainText('Strength Block');
    await expect(page.locator('tbody')).toContainText('5 days');
  });

  test('uses default microcycle length when not specified', async ({ page }) => {
    await page.locator('input[placeholder*="4-Week"]').fill('Default Block');
    await page.click('button:has-text("+ Add Mesocycle")');
    await page.waitForTimeout(500);

    await expect(page.locator('tbody')).toContainText('7 days');
  });

  test('displays mesocycle table with workout count', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block One');
    await addMesocycleViaUI(page, 'Block Two');

    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody')).toContainText('0 workouts');
  });

  test('edits a mesocycle via modal', async ({ page }) => {
    await addMesocycleViaUI(page, 'Original Name', 4);

    await page.locator('button:has-text("Edit")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Renamed Block');
    await page.locator('.modal-box input[type="number"]').fill('10');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('tbody')).toContainText('Renamed Block');
    await expect(page.locator('tbody')).toContainText('10 days');
  });

  test('deletes a mesocycle with confirmation', async ({ page }) => {
    await addMesocycleViaUI(page, 'Delete Me');
    await expect(page.locator('tbody tr')).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('button:has-text("Del")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('navigates to mesocycle calendar on View click', async ({ page }) => {
    await addMesocycleViaUI(page, 'View Block');
    const row = page.locator('tr', { hasText: 'View Block' });
    await row.locator('a:has-text("View")').click();
    await page.waitForSelector('.day-grid', { timeout: 5000 });

    await expect(page.locator('.breadcrumb')).toContainText('View Block');
    await expect(page).toHaveURL(/\/mesocycles\//);
  });

  test('clears the add form after successful submission', async ({ page }) => {
    await addMesocycleViaUI(page, 'Test Block');

    const nameInput = page.locator('input[placeholder*="4-Week"]');
    await expect(nameInput).toHaveValue('');
  });
});
