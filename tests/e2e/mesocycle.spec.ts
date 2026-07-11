import { test, expect } from '@playwright/test';
import {
  clearDatabase, createProgramViaUI, viewProgram,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI,
} from './setup';

test.describe('Mesocycle Page — Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await createProgramViaUI(page, 'PPL Program');
    await viewProgram(page, 'PPL Program');
    await addMesocycleViaUI(page, 'Block 1', 7);
    await viewMesocycle(page, 'Block 1');
  });

  test('displays breadcrumb with full hierarchy', async ({ page }) => {
    await expect(page.locator('.breadcrumb')).toContainText('PPL Program');
    await expect(page.locator('.breadcrumb')).toContainText('Block 1');
  });

  test('renders correct number of day cells based on microcycle length', async ({ page }) => {
    const cells = page.locator('.day-cell');
    await expect(cells).toHaveCount(7);
    await expect(cells.first()).toContainText('Day 1');
  });

  test('adds a workout to a day cell', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Push A');

    await expect(page.locator('.day-cell').first()).toContainText('Push A');
  });

  test('adds multiple workouts to the same day', async ({ page }) => {
    await addWorkoutViaUI(page, 2, 'Squats');
    await addWorkoutViaUI(page, 2, 'Deadlifts');

    const cell = page.locator('.day-cell').nth(2);
    await expect(cell.locator('.workout-chip')).toHaveCount(2);
  });

  test('adds workouts to different days', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Push A');
    await addWorkoutViaUI(page, 1, 'Pull A');
    await addWorkoutViaUI(page, 2, 'Legs A');

    await expect(page.locator('.day-cell').nth(0)).toContainText('Push A');
    await expect(page.locator('.day-cell').nth(1)).toContainText('Pull A');
    await expect(page.locator('.day-cell').nth(2)).toContainText('Legs A');
  });

  test('deletes a workout from a day cell', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Remove Me');
    await expect(page.locator('.day-cell').first()).toContainText('Remove Me');

    await page.locator('.workout-chip button.btn-danger').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-danger').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.day-cell').first()).not.toContainText('Remove Me');
  });

  test('navigates to workout page on chip click', async ({ page }) => {
    await addWorkoutViaUI(page, 3, 'Chest Day');
    await page.locator('.workout-chip', { hasText: 'Chest Day' }).click();
    await page.waitForSelector('.breadcrumb', { timeout: 5000 });

    await expect(page.locator('.page-header h1')).toHaveText('Chest Day');
    await expect(page).toHaveURL(/\/programs\/.*\/workouts\//);
  });

  test('closes add workout modal with Cancel', async ({ page }) => {
    await page.locator('.day-cell').first().locator('button:has-text("+ Add workout")').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.modal-content')).toHaveCount(0);
    await expect(page.locator('.day-cell').first().locator('.workout-chip')).toHaveCount(0);
  });

  test('shows correct day labels on each day cell', async ({ page }) => {
    const cells = page.locator('.day-cell');
    for (let i = 0; i < 7; i++) {
      await expect(cells.nth(i)).toContainText(`Day ${i + 1}`);
    }
  });
});
