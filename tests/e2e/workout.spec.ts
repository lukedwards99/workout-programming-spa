import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI,
} from './setup';

test.describe('Workout Page — Exercises & Sets', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);

    const programId = await seedProgramViaUI(page, 'Test PPL');

    await navigateTo(page, `/programs/${programId}/exercises`);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Barbell Bench Press');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Incline Dumbbell Press');

    await navigateTo(page, `/programs/${programId}`);
    await addMesocycleViaUI(page, 'Block 1', 7);
    await viewMesocycle(page, 'Block 1');
    await addWorkoutViaUI(page, 0, 'Push Day');
    await openWorkout(page, 'Push Day');
  });

  test('shows empty state when no exercises', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state p')).toHaveText(/No exercises yet/);
  });

  test('adds an exercise to the workout', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await expect(page.locator('.exercise-block')).toHaveCount(1);
    await expect(page.locator('.exercise-block h3').first()).toHaveText('Barbell Bench Press');
  });

  test('adds multiple exercises to the workout', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addExerciseViaUI(page, 'Incline Dumbbell Press');
    await expect(page.locator('.exercise-block')).toHaveCount(2);
  });

  test('adds an exercise using the bottom add-exercise button', async ({ page }) => {
    await page.locator('button:has-text("+ Add Exercise")').last().click();
    await page.waitForSelector('.modal-content');
    const selects = page.locator('.modal-content select');
    await selects.first().selectOption({ index: 1 });
    await selects.nth(1).selectOption({ label: 'Barbell Bench Press' });
    await page.locator('.modal-content button:has-text("Add")').click();

    await expect(page.locator('.exercise-block h3').first()).toHaveText('Barbell Bench Press');
  });

  test('moves an exercise block up and persists its order', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addExerciseViaUI(page, 'Incline Dumbbell Press');

    const blocks = page.locator('.exercise-block');
    await expect(blocks.nth(0).locator('h3')).toHaveText('Barbell Bench Press');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Incline Dumbbell Press');
    await expect(page.getByRole('button', { name: 'Move Barbell Bench Press up' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move Incline Dumbbell Press down' })).toBeDisabled();

    await page.getByRole('button', { name: 'Move Incline Dumbbell Press up' }).click();
    await expect(blocks.nth(0).locator('h3')).toHaveText('Incline Dumbbell Press');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Barbell Bench Press');

    await page.reload();
    await expect(blocks.nth(0).locator('h3')).toHaveText('Incline Dumbbell Press');
  });

  test('a new exercise starts with one normal set', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    const rows = page.locator('.exercise-block').first().locator('.set-table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('normal');
  });

  test('adds sets of different types', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addSetViaUI(page, 'warmup');
    await addSetViaUI(page, 'normal');
    await addSetViaUI(page, 'dropset');
    await addSetViaUI(page, 'failure');
    await addSetViaUI(page, 'rest-pause');

    const body = page.locator('.exercise-block').first().locator('.set-table tbody');
    await expect(body.locator('tr')).toHaveCount(6);
    await expect(body).toContainText('warmup');
    await expect(body).toContainText('normal');
    await expect(body).toContainText('dropset');
    await expect(body).toContainText('failure');
    await expect(body).toContainText('rest-pause');
  });

  test('set inputs exist and are editable', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    const firstRow = page.locator('.exercise-block').first().locator('.set-table tbody tr').first();
    const inputs = firstRow.locator('input');
    await expect(inputs).toHaveCount(4);
    await expect(page.locator('.exercise-block').first()).toContainText('normal');
  });

  test('deletes a set from an exercise', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addSetViaUI(page, 'normal');
    await expect(page.locator('.exercise-block').first().locator('.set-table tbody tr')).toHaveCount(2);
    await page.locator('.exercise-block').first().locator('.set-table tbody tr').first().locator('button.btn-danger.btn-xs').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.exercise-block').first().locator('.set-table tbody tr')).toHaveCount(1);
  });

  test('removes an exercise from the workout', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await expect(page.locator('.exercise-block')).toHaveCount(1);
    await page.locator('.exercise-block').first().locator('button.btn-danger.btn-sm').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-danger').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('summary stats show exercise count', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addExerciseViaUI(page, 'Incline Dumbbell Press');
    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('2');
  });

  test('summary stats update working sets count', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('1');
    await addSetViaUI(page, 'warmup');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('1');
    await addSetViaUI(page, 'normal');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('2');
    await addSetViaUI(page, 'rest-pause');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('3');
  });
});
