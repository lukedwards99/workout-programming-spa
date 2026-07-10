import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
} from './setup';

test.describe('Copy Exercises Between Programs', () => {
  test.skip('copies selected exercises from one program to another', async ({ page }) => {
    await clearDatabase(page);

    const idA = await seedProgramViaUI(page, 'Program A');
    await navigateTo(page, `/programs/${idA}/exercises`);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Barbell Bench Press');
    await addExerciseGroupViaUI(page, 'Back');
    await addExerciseToLibraryViaUI(page, 'Back', 'Pull-Up');

    await navigateTo(page, '/');
    const idB = await seedProgramViaUI(page, 'Program B');
    await navigateTo(page, `/programs/${idB}/exercises`);
    await expect(page.locator('.ex-item')).toHaveCount(0);

    await page.click('button:has-text("Copy from Program")');
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content select').selectOption('Program A');
    await page.waitForTimeout(1000);

    const checkboxes = page.locator('.modal-content input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();

    // Copy just the first exercise
    await checkboxes.first().check();
    await page.waitForTimeout(300);

    await page.locator('button:has-text("Copy Selected")').click();
    await page.waitForTimeout(1500);

    await expect(page.locator('.ex-item').filter({ hasText: 'Barbell Bench Press' })).toBeVisible();
    await expect(page.locator('.ex-item')).toHaveCount(1);
  });

  test('copy button is disabled when no exercises are selected', async ({ page }) => {
    await clearDatabase(page);

    await seedProgramViaUI(page, 'Source');
    await navigateTo(page, '/');
    const idB = await seedProgramViaUI(page, 'Target');
    await navigateTo(page, `/programs/${idB}/exercises`);

    await page.click('button:has-text("Copy from Program")');
    await page.waitForSelector('.modal-content');

    const copyBtn = page.locator('.modal-content button:has-text("Copy Selected")');
    await expect(copyBtn).toBeDisabled();
  });

  test('copy modal can be cancelled', async ({ page }) => {
    await clearDatabase(page);

    const idA = await seedProgramViaUI(page, 'Source');
    await navigateTo(page, `/programs/${idA}/exercises`);
    await addExerciseGroupViaUI(page, 'Arms');
    await addExerciseToLibraryViaUI(page, 'Arms', 'Curl');

    await navigateTo(page, '/');
    const idB = await seedProgramViaUI(page, 'Target');
    await navigateTo(page, `/programs/${idB}/exercises`);

    await page.click('button:has-text("Copy from Program")');
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.modal-content')).toHaveCount(0);
    await expect(page.locator('.ex-item')).toHaveCount(0);
  });
});
