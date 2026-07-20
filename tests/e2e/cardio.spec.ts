import { test, expect } from '@playwright/test';
import { clearDatabase, createProgramViaUI, viewProgram, addMesocycleViaUI, viewMesocycle } from './setup';

test.describe('Cardio sessions', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await createProgramViaUI(page, 'Cardio Program');
    await viewProgram(page, 'Cardio Program');
    await addMesocycleViaUI(page, 'Base Block', 7);
    await viewMesocycle(page, 'Base Block');
  });

  test('adds, edits, and reports a cardio session', async ({ page }) => {
    await page.locator('.day-cell').first().getByRole('button', { name: '+ Add session' }).click();
    await page.locator('.modal-content select').first().selectOption('cardio');
    await page.locator('.modal-content').getByLabel('Session name').fill('Easy Run');
    await page.locator('.modal-content').getByLabel('Modality').fill('Running');
    await page.locator('.modal-content').getByLabel('Planned minutes').fill('45');
    await page.locator('.modal-content').getByLabel('Target RPE (1–10)').fill('4');
    await page.locator('.modal-content button:has-text("Add")').click();

    await expect(page.locator('.day-cell').first()).toContainText('Easy Run');
    await page.getByRole('button', { name: 'Edit Easy Run' }).click();
    await page.locator('.modal-content').getByLabel('Completed minutes').fill('42');
    await page.locator('.modal-content').getByLabel('Actual RPE').fill('5');
    await page.locator('.modal-content button:has-text("Save Changes")').click();

    await page.getByRole('button', { name: 'Cardio Summary' }).click();
    await expect(page.locator('[aria-label="Cardio summary"]')).toContainText('45');
    await expect(page.locator('[aria-label="Cardio summary"]')).toContainText('42');
    await expect(page.locator('.responsive-table')).toContainText('Easy Run');
  });
});
