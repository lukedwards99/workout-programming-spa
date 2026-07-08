import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI,
} from './setup';
import fs from 'fs';

test.describe('Regression Tests', () => {
  test.describe('P1-1: Set field persistence after edit', () => {
    test('edited reps survive a page reload', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Test PPL');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      await navigateTo(page, `/programs/${programId}`);
      await addMesocycleViaUI(page, 'Block 1', 7);
      await viewMesocycle(page, 'Block 1');
      await addWorkoutViaUI(page, 0, 'Push Day');
      await openWorkout(page, 'Push Day');

      await addExerciseViaUI(page, 'Bench Press');

      // Fill reps
      const firstRow = page.locator('.exercise-block').first().locator('.set-table tbody tr').first();
      await firstRow.locator('input').nth(0).fill('12');
      await page.waitForTimeout(500);

      // Reload and verify
      await page.reload();
      await page.waitForSelector('.nav-bar', { timeout: 10000 });
      await page.waitForSelector('.exercise-block', { timeout: 10000 });
      await page.waitForTimeout(500);

      await expect(firstRow.locator('input').nth(0)).toHaveValue('12');
    });
  });

  test.describe('P1-2: Cascade delete after reload', () => {
    test('deleting a program removes its mesocycles', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Delete Test');
      await addMesocycleViaUI(page, 'Child Block');
      await page.waitForTimeout(500);

      // Go home to delete
      await navigateTo(page, '/');
      await page.waitForTimeout(300);

      // Delete program
      page.once('dialog', (dialog) => dialog.accept());
      await page.locator('button:has-text("Delete")').click();
      await page.waitForTimeout(500);

      // Create a new program and check that Child Block is gone
      await seedProgramViaUI(page, 'New Program');
      // Verify there are exactly 0 mesocycles (Child Block should be deleted)
      await expect(page.locator('.empty-state p')).toHaveText(/No mesocycles yet/);
    });
  });

  test.describe('P1-3: Per-program stats isolation', () => {
    test('Data tab shows only the current program stats', async ({ page }) => {
      await clearDatabase(page);

      // Program A with exercises
      const idA = await seedProgramViaUI(page, 'Program A');
      await addMesocycleViaUI(page, 'Block A');
      await navigateTo(page, `/programs/${idA}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      // Program B with exercises
      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Program B');
      await addMesocycleViaUI(page, 'Block B');
      await navigateTo(page, `/programs/${idB}/exercises`);
      await addExerciseGroupViaUI(page, 'Back');
      await addExerciseToLibraryViaUI(page, 'Back', 'Pull Up');

      // Check Program A's stats
      await navigateTo(page, `/programs/${idA}/data`);
      await expect(page.locator('.stat-card').filter({ hasText: 'Mesocycles' }).locator('.val')).toHaveText('1');
      await expect(page.locator('.stat-card').filter({ hasText: 'Exercises' }).locator('.val')).toHaveText('1');
      await expect(page.locator('.stat-card').filter({ hasText: 'Groups' }).locator('.val')).toHaveText('1');

      // Check Program B's stats
      await navigateTo(page, `/programs/${idB}/data`);
      await expect(page.locator('.stat-card').filter({ hasText: 'Mesocycles' }).locator('.val')).toHaveText('1');
      await expect(page.locator('.stat-card').filter({ hasText: 'Exercises' }).locator('.val')).toHaveText('1');
      await expect(page.locator('.stat-card').filter({ hasText: 'Groups' }).locator('.val')).toHaveText('1');
    });
  });

  test.describe('P1-4: Variation-specific workout blocks', () => {
    test('same exercise with different variations creates separate blocks', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Variation Test');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      // Add a variation
      await page.locator('.ex-item-header').click();
      await page.waitForTimeout(300);
      await page.locator('.ex-item-detail input').fill('Close Grip');
      await page.locator('.ex-item-detail button:has-text("+")').click();
      await page.waitForTimeout(400);

      // Create a workout
      await navigateTo(page, `/programs/${programId}`);
      await addMesocycleViaUI(page, 'Block 1', 7);
      await viewMesocycle(page, 'Block 1');
      await addWorkoutViaUI(page, 0, 'Push Day');
      await openWorkout(page, 'Push Day');

      // Add Bench Press with Close Grip variation
      await page.click('button:has-text("+ Add Exercise")');
      await page.waitForSelector('.modal-box');
      await page.locator('.modal-box select').first().selectOption({ label: 'Bench Press' });
      await page.locator('.modal-box select').last().selectOption({ label: 'Close Grip' });
      await page.locator('.modal-box button:has-text("Add")').click();
      await page.waitForTimeout(500);

      // Add Bench Press without variation also
      await page.click('button:has-text("+ Add Exercise")');
      await page.waitForSelector('.modal-box');
      await page.locator('.modal-box select').first().selectOption({ label: 'Bench Press' });
      await page.locator('.modal-box button:has-text("Add")').click();
      await page.waitForTimeout(500);

      // Should show 2 blocks (one with variation, one without)
      await expect(page.locator('.exercise-block')).toHaveCount(2);
      await expect(page.locator('.exercise-block').first()).toContainText('Close Grip');
    });
  });

  test.describe('P2-1: Set renumbering after deletion', () => {
    test('deleting a middle set renumbers remaining sets', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Renumber Test');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      await navigateTo(page, `/programs/${programId}`);
      await addMesocycleViaUI(page, 'Block 1', 7);
      await viewMesocycle(page, 'Block 1');
      await addWorkoutViaUI(page, 0, 'Push Day');
      await openWorkout(page, 'Push Day');

      await addExerciseViaUI(page, 'Bench Press');
      await addSetViaUI(page, 'normal'); // set #2
      await addSetViaUI(page, 'normal'); // set #3

      // Delete set #2 (the second row)
      await page.locator('.exercise-block').first().locator('.set-table tbody tr').nth(1).locator('button.btn-danger.btn-xs').click();
      await page.waitForTimeout(500);

      // Should have 2 rows (was 3, deleted 1) with set #s 1 and 2
      const rows = page.locator('.exercise-block').first().locator('.set-table tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0).locator('td').first()).toHaveText('1');
      await expect(rows.nth(1).locator('td').first()).toHaveText('2');
    });
  });

  test.describe('P3-1: Duplicate import prevention', () => {
    test('importing the same file twice does not create duplicates', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Import Test');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      // Export
      await navigateTo(page, `/programs/${programId}/data`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Export Exercises")'),
      ]);
      const tempPath = await download.path();
      const buffer = fs.readFileSync(tempPath);

      // Import first time — should succeed
      const fileChooserPromise1 = page.waitForEvent('filechooser');
      await page.locator('.file-drop-zone').click();
      const fc1 = await fileChooserPromise1;
      await fc1.setFiles({ name: 'export.json', mimeType: 'application/json', buffer });
      await page.waitForTimeout(500);
      await page.click('button:has-text("Import Exercises")');
      await page.waitForTimeout(1000);

      // Check exercise count
      await navigateTo(page, `/programs/${programId}/exercises`);
      await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toHaveCount(1);

      // Import second time — should not duplicate
      await navigateTo(page, `/programs/${programId}/data`);
      const fileChooserPromise2 = page.waitForEvent('filechooser');
      await page.locator('.file-drop-zone').click();
      const fc2 = await fileChooserPromise2;
      await fc2.setFiles({ name: 'export.json', mimeType: 'application/json', buffer });
      await page.waitForTimeout(500);
      await page.click('button:has-text("Import Exercises")');
      await page.waitForTimeout(1000);

      // Still 1 exercise
      await navigateTo(page, `/programs/${programId}/exercises`);
      await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toHaveCount(1);
    });
  });
});
