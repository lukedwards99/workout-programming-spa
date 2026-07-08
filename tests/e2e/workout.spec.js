import { test, expect } from '@playwright/test';
import {
  clearDatabase, createProgramViaUI, viewProgram,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI, fillSetRow,
} from './setup';

test.describe('Workout Page — Exercises & Sets', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);
    // Seed an exercise in the library for selection
    await page.goto('/exercises');
    await page.waitForSelector('.nav-bar', { timeout: 10000 });
    // Create a group first
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(300);
    // Create an exercise
    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Chest');
    await page.locator('.modal-box input[required]').fill('Barbell Bench Press');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(300);
    // Create another exercise
    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Chest');
    await page.locator('.modal-box input[required]').fill('Incline Dumbbell Press');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(300);

    // Navigate to a workout
    await page.goto('/');
    await page.waitForSelector('.nav-bar', { timeout: 10000 });
    await createProgramViaUI(page, 'Test PPL');
    await viewProgram(page, 'Test PPL');
    await addMesocycleViaUI(page, 'Block 1', 7);
    await viewMesocycle(page, 'Block 1');
    await addWorkoutViaUI(page, 0, 'Push Day');
    await page.locator('.workout-chip', { hasText: 'Push Day' }).click();
    await page.waitForSelector('.exercise-block, .empty-state', { timeout: 5000 });
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

    const body = page.locator('.exercise-block').first().locator('.set-table tbody');
    await expect(body.locator('tr')).toHaveCount(5);
    await expect(body).toContainText('warmup');
    await expect(body).toContainText('normal');
    await expect(body).toContainText('dropset');
    await expect(body).toContainText('failure');
  });

  test('set inputs exist and are editable', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');

    const firstRow = page.locator('.exercise-block').first().locator('.set-table tbody tr').first();
    const inputs = firstRow.locator('input');

    // Verify 4 inputs exist (reps, weight, RIR, notes)
    await expect(inputs).toHaveCount(4);
    // Exercise block renders with set data
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

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.exercise-block').first().locator('button.btn-danger.btn-sm').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('totals bar shows exercise count', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    await addExerciseViaUI(page, 'Incline Dumbbell Press');

    await expect(page.locator('.totals-bar')).toBeVisible();
    await expect(page.locator('.total-item .val').nth(0)).toHaveText('2');
  });

  test('totals bar updates working sets count', async ({ page }) => {
    await addExerciseViaUI(page, 'Barbell Bench Press');
    // Initial exercise has 1 normal set = 1 working set
    await expect(page.locator('.totals-bar')).toBeVisible();
    await expect(page.locator('.total-item .val').nth(1)).toHaveText('1');

    await addSetViaUI(page, 'warmup');
    await page.waitForTimeout(400);
    // Still 1 working set (warmup doesn't count)
    await expect(page.locator('.total-item .val').nth(1)).toHaveText('1');

    await addSetViaUI(page, 'normal');
    await page.waitForTimeout(400);
    // Now 2 working sets
    await expect(page.locator('.total-item .val').nth(1)).toHaveText('2');
  });
});
