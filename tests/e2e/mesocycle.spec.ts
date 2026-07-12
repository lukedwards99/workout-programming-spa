import { test, expect } from '@playwright/test';
import {
  clearDatabase, createProgramViaUI, viewProgram,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI,
  openWorkoutEdit, editWorkout, copyWorkout,
  openWorkout, addExerciseViaUI, addSetViaUI, fillSetRow,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
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

  test('renders correct number of day cells based on mesocycle length', async ({ page }) => {
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

    await openWorkoutEdit(page, 'Remove Me');
    await page.locator('.modal-content button:has-text("Delete")').click();
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

  // ── Edit modal ──

  test('renames a workout via edit modal', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Old Name');
    await editWorkout(page, 'Old Name', 'Renamed');

    await expect(page.locator('.day-cell').first()).toContainText('Renamed');
    await expect(page.locator('.day-cell').first()).not.toContainText('Old Name');
  });

  test('moves a workout to another day via edit modal', async ({ page }) => {
    await addWorkoutViaUI(page, 1, 'Movable');
    await editWorkout(page, 'Movable', 'Movable', 4);

    await expect(page.locator('.day-cell').nth(1)).not.toContainText('Movable');
    await expect(page.locator('.day-cell').nth(4)).toContainText('Movable');
  });

  test('renames and moves a workout together', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Original');
    await editWorkout(page, 'Original', 'Relocated', 5);

    await expect(page.locator('.day-cell').first()).not.toContainText('Original');
    await expect(page.locator('.day-cell').nth(5)).toContainText('Relocated');
    await expect(page.locator('.day-cell').nth(5)).not.toContainText('Original');
  });

  test('copies a workout to another day', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Squat Day');
    await copyWorkout(page, 'Squat Day', 2);

    await expect(page.locator('.day-cell').first()).toContainText('Squat Day');
    await expect(page.locator('.day-cell').nth(2)).toContainText('Squat Day (Copy)');
  });

  test('deep copies a workout with exercises and sets', async ({ page }) => {
    const mesoUrl = page.url();
    const m = mesoUrl.match(/\/programs\/(\d+)\//);
    const pid = m ? m[1] : '1';

    await page.goto(`/programs/${pid}/exercises`);
    await page.waitForSelector('.nav-bar');
    await addExerciseGroupViaUI(page, 'Legs');
    await addExerciseToLibraryViaUI(page, 'Legs', 'Squat');

    await page.goto(mesoUrl);
    await page.waitForSelector('.day-cell');

    await addWorkoutViaUI(page, 0, 'Deep Source');
    await openWorkout(page, 'Deep Source');
    await addExerciseViaUI(page, 'Squat');
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 0, { reps: 10, weight: 100, rir: 2 });

    await page.goto(mesoUrl);
    await page.waitForSelector('.day-cell');

    await copyWorkout(page, 'Deep Source', 1);

    await expect(page.locator('.day-cell').nth(1)).toContainText('Deep Source (Copy)');
    await openWorkout(page, 'Deep Source (Copy)');
    await expect(page.locator('.exercise-block')).toHaveCount(1);
    await expect(page.locator('.exercise-block').first()).toContainText('Squat');
    await expect(page.locator('.exercise-block').first().locator('td[data-label="Reps"] input').first()).toHaveValue('10');
    await expect(page.locator('.exercise-block').first().locator('td[data-label="Weight"] input').first()).toHaveValue('100');
  });

  test('cancel does not mutate data', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Keep Me');
    await openWorkoutEdit(page, 'Keep Me');
    await page.locator('#edit-workout-name').fill('Nope');
    await page.locator('.modal-content button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.modal-content')).toHaveCount(0);
    await expect(page.locator('.day-cell').first()).toContainText('Keep Me');
    await expect(page.locator('.day-cell').first()).not.toContainText('Nope');
  });

  test('disables Save and Copy when name is empty', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Something');
    await openWorkoutEdit(page, 'Something');
    await page.locator('#edit-workout-name').fill('');

    await expect(page.locator('.modal-content button:has-text("Save Changes")')).toBeDisabled();
    await expect(page.locator('.modal-content button:has-text("Copy Workout")')).toBeDisabled();
  });

  test('workout name click navigates to detail page', async ({ page }) => {
    await addWorkoutViaUI(page, 3, 'Chest Day');
    await page.locator('.workout-chip', { hasText: 'Chest Day' }).click();
    await page.waitForSelector('.breadcrumb', { timeout: 5000 });

    await expect(page.locator('.page-header h1')).toHaveText('Chest Day');
    await expect(page).toHaveURL(/\/programs\/.*\/workouts\//);
  });

  test('edit button does not navigate and delete is in edit modal', async ({ page }) => {
    await addWorkoutViaUI(page, 0, 'Btn Test');

    const editBtn = page.locator('[aria-label="Edit Btn Test"]');
    await editBtn.click();
    await page.waitForSelector('.modal-content');
    await expect(page.locator('.modal-title')).toHaveText('Edit Workout');
    await expect(page).not.toHaveURL(/\/workouts\//);

    await page.locator('.modal-content button:has-text("Delete")').click();
    await page.waitForSelector('.modal-content');
    await expect(page.locator('.modal-title')).toHaveText('Delete Workout');
    await expect(page).not.toHaveURL(/\/workouts\//);
  });
});
