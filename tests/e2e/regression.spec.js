import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI,
} from './setup';
import fs from 'fs';
import initSqlJs from 'sql.js';

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

  test.describe('P1-5: Variation-aware set renumbering', () => {
    test('deleting a set from one variation block does not affect another', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'VarRenumber');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      await page.locator('.ex-item-header').click();
      await page.waitForTimeout(300);
      await page.locator('.ex-item-detail input').fill('Close Grip');
      await page.locator('.ex-item-detail button:has-text("+")').click();
      await page.waitForTimeout(400);

      await navigateTo(page, `/programs/${programId}`);
      await addMesocycleViaUI(page, 'Block 1', 7);
      await viewMesocycle(page, 'Block 1');
      await addWorkoutViaUI(page, 0, 'Push Day');
      await openWorkout(page, 'Push Day');

      // Add Bench Press with Close Grip
      await page.click('button:has-text("+ Add Exercise")');
      await page.waitForSelector('.modal-box');
      await page.locator('.modal-box select').first().selectOption({ label: 'Bench Press' });
      await page.locator('.modal-box select').last().selectOption({ label: 'Close Grip' });
      await page.locator('.modal-box button:has-text("Add")').click();
      await page.waitForTimeout(500);

      // Add Bench Press without variation
      await page.click('button:has-text("+ Add Exercise")');
      await page.waitForSelector('.modal-box');
      await page.locator('.modal-box select').first().selectOption({ label: 'Bench Press' });
      await page.locator('.modal-box button:has-text("Add")').click();
      await page.waitForTimeout(500);

      // Add sets to both blocks
      const blocks = page.locator('.exercise-block');
      await expect(blocks).toHaveCount(2);

      // Add 2 more sets to first block (Close Grip)
      await blocks.nth(0).locator('button:has-text("+ Set")').click();
      await page.waitForTimeout(300);
      await blocks.nth(0).locator('button:has-text("+ Set")').click();
      await page.waitForTimeout(300);

      // Add 1 more set to second block (no variation)
      await blocks.nth(1).locator('button:has-text("+ Set")').click();
      await page.waitForTimeout(300);

      // Delete set #2 from first block
      await blocks.nth(0).locator('.set-table tbody tr').nth(1).locator('button.btn-danger.btn-xs').click();
      await page.waitForTimeout(500);

      // First block should have sets #1, #2 (was 3 rows, deleted middle, renumbered to 2)
      const rowsA = blocks.nth(0).locator('.set-table tbody tr');
      await expect(rowsA).toHaveCount(2);
      await expect(rowsA.nth(0).locator('td').first()).toHaveText('1');
      await expect(rowsA.nth(1).locator('td').first()).toHaveText('2');

      // Second block should still have independent set numbers #1, #2
      const rowsB = blocks.nth(1).locator('.set-table tbody tr');
      await expect(rowsB).toHaveCount(2);
      await expect(rowsB.nth(0).locator('td').first()).toHaveText('1');
      await expect(rowsB.nth(1).locator('td').first()).toHaveText('2');
    });
  });

  test.describe('P2-2: Malformed import preserves existing data', () => {
    test('importing a fake SQLite file with missing tables fails gracefully', async ({ page }) => {
      // Create a minimal SQLite file with schema_version but no app tables
      const SQL = await initSqlJs();
      const badDb = new SQL.Database();
      badDb.run('CREATE TABLE schema_version (version INTEGER)');
      badDb.run('INSERT INTO schema_version (version) VALUES (2)');
      const fakeBuffer = Buffer.from(badDb.export());
      badDb.close();

      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Validation Program');
      await addMesocycleViaUI(page, 'Real Block');

      // Verify real data exists
      await navigateTo(page, `/programs/${programId}`);
      await expect(page.locator('td:has-text("Real Block")')).toBeVisible();

      // Navigate to data tab to trigger full import
      await navigateTo(page, `/programs/${programId}/data`);

      // Trigger full import with the malformed file
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text=Restore Full Backup');
      const fc = await fileChooserPromise;
      await fc.setFiles({ name: 'fake.db', mimeType: 'application/octet-stream', buffer: fakeBuffer });
      await page.waitForTimeout(1000);

      // Should show error alert — import was rejected
      await expect(page.locator('.alert-danger')).toBeVisible();

      // Real data should still be intact
      await navigateTo(page, `/programs/${programId}`);
      await expect(page.locator('td:has-text("Real Block")')).toBeVisible();
    });
  });

  test.describe('P2-3: Duplicate exercise block prevention', () => {
    test('cannot add the same exercise+variation combo twice', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Dup Prevent');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      await navigateTo(page, `/programs/${programId}`);
      await addMesocycleViaUI(page, 'Block 1', 7);
      await viewMesocycle(page, 'Block 1');
      await addWorkoutViaUI(page, 0, 'Push Day');
      await openWorkout(page, 'Push Day');

      // Add Bench Press
      await addExerciseViaUI(page, 'Bench Press');
      await expect(page.locator('.exercise-block')).toHaveCount(1);

      // Try adding same exercise again
      await page.click('button:has-text("+ Add Exercise")');
      await page.waitForSelector('.modal-box');
      await page.locator('.modal-box select').first().selectOption({ label: 'Bench Press' });
      await page.locator('.modal-box button:has-text("Add")').click();
      await page.waitForTimeout(500);

      // Should show warning and still have only 1 block
      await expect(page.locator('.alert-warn')).toBeVisible();
      await expect(page.locator('.exercise-block')).toHaveCount(1);
    });
  });

  test.describe('P2-4: Valid full backup restore', () => {
    test('export then import restores data correctly', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Backup Test');
      await addMesocycleViaUI(page, 'Block Alpha');

      await navigateTo(page, `/programs/${programId}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      // Export full .sqlite backup
      await navigateTo(page, `/programs/${programId}/data`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download Full Backup")'),
      ]);
      const tempPath = await download.path();
      const buffer = fs.readFileSync(tempPath);

      // Delete all data
      page.once('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("Delete All Data")');
      await page.waitForTimeout(500);

      // Verify data is gone
      await navigateTo(page, '/');
      await expect(page.locator('.empty-state p')).toBeVisible();

      // Create a fresh program so the app is initialized
      const newProgramId = await seedProgramViaUI(page, 'Restore Program');

      // Import the backup
      await navigateTo(page, `/programs/${newProgramId}/data`);
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text=Restore Full Backup');
      const fc = await fileChooserPromise;
      await fc.setFiles({ name: 'backup.sqlite', mimeType: 'application/octet-stream', buffer });
      await page.waitForTimeout(1000);

      // Verify restored data
      await navigateTo(page, `/programs/${programId}`);
      await expect(page.locator('td:has-text("Block Alpha")')).toBeVisible();

      // Verify restored exercises
      await navigateTo(page, `/programs/${programId}/exercises`);
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toBeVisible();
    });
  });

  test.describe('P3-2: Seed default exercises', () => {
    test('seed populates default exercise library without duplicates', async ({ page }) => {
      await clearDatabase(page);
      const programId = await seedProgramViaUI(page, 'Seed Test');

      await navigateTo(page, `/programs/${programId}/data`);

      // Confirm dialog and click seed
      page.once('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("Seed Default Exercises")');
      await page.waitForTimeout(1000);

      // Navigate to exercises tab and verify groups were created
      await navigateTo(page, `/programs/${programId}/exercises`);
      await expect(page.locator('.group-item:has-text("Chest")')).toBeVisible();
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toBeVisible();
      await expect(page.locator('.group-item:has-text("Legs")')).toBeVisible();
      await expect(page.locator('.ex-item:has-text("Barbell Squat")')).toBeVisible();

      // Seed again — should not duplicate
      await navigateTo(page, `/programs/${programId}/data`);
      page.once('dialog', (dialog) => dialog.accept());
      await page.click('button:has-text("Seed Default Exercises")');
      await page.waitForTimeout(1000);

      await navigateTo(page, `/programs/${programId}/exercises`);
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toHaveCount(1);
    });
  });
});
