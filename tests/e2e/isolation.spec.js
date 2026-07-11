import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI,
} from './setup';
import fs from 'fs';

test.describe('Program Data Isolation', () => {
  test.describe('ISO-1: Two programs with distinct data', () => {
    test('changes in program A never appear in program B after navigation', async ({ page }) => {
      await clearDatabase(page);

      // Create Program A with data
      const idA = await seedProgramViaUI(page, 'Isolation Program A');
      await addMesocycleViaUI(page, 'Block A', 5);
      await navigateTo(page, `/programs/${idA}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

      // Create Program B with different data
      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Isolation Program B');
      await addMesocycleViaUI(page, 'Block B', 7);
      await navigateTo(page, `/programs/${idB}/exercises`);
      await addExerciseGroupViaUI(page, 'Back');
      await addExerciseToLibraryViaUI(page, 'Back', 'Pull Up');

      // Verify A only has its own data
      await navigateTo(page, `/programs/${idA}`);
      await expect(page.locator('td:has-text("Block A")')).toBeVisible();
      await expect(page.locator('td:has-text("Block B")')).toHaveCount(0);

      await navigateTo(page, `/programs/${idA}/exercises`);
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toBeVisible();
      await expect(page.locator('.ex-item:has-text("Pull Up")')).toHaveCount(0);

      // Verify B only has its own data
      await navigateTo(page, `/programs/${idB}`);
      await expect(page.locator('td:has-text("Block B")')).toBeVisible();
      await expect(page.locator('td:has-text("Block A")')).toHaveCount(0);

      await navigateTo(page, `/programs/${idB}/exercises`);
      await expect(page.locator('.ex-item:has-text("Pull Up")')).toBeVisible();
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toHaveCount(0);
    });

    test('changes in A do not appear in B after reload', async ({ page }) => {
      await clearDatabase(page);

      const idA = await seedProgramViaUI(page, 'Reload A');
      await addMesocycleViaUI(page, 'Meso A');
      await navigateTo(page, `/programs/${idA}/exercises`);
      await addExerciseGroupViaUI(page, 'Arms');
      await addExerciseToLibraryViaUI(page, 'Arms', 'Curl');

      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Reload B');
      await addMesocycleViaUI(page, 'Meso B');

      // Reload and verify isolation is maintained
      await page.reload();
      await page.waitForSelector('.nav-bar', { timeout: 10000 });
      await page.waitForTimeout(500);

      await navigateTo(page, `/programs/${idA}`);
      await expect(page.locator('td:has-text("Meso A")')).toBeVisible();
      await expect(page.locator('td:has-text("Meso B")')).toHaveCount(0);

      await navigateTo(page, `/programs/${idB}`);
      await expect(page.locator('td:has-text("Meso B")')).toBeVisible();
      await expect(page.locator('td:has-text("Meso A")')).toHaveCount(0);
    });
  });

  test.describe('ISO-2: Deleting program A leaves B intact', () => {
    test('delete A removes A data but B remains complete', async ({ page }) => {
      await clearDatabase(page);

      const idA = await seedProgramViaUI(page, 'Delete Me A');
      await addMesocycleViaUI(page, 'Meso A');

      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Keep Me B');
      await addMesocycleViaUI(page, 'Meso B');

      await navigateTo(page, `/programs/${idB}/exercises`);
      await addExerciseGroupViaUI(page, 'Legs');
      await addExerciseToLibraryViaUI(page, 'Legs', 'Squat');

      // Delete A
      await navigateTo(page, '/');
      await expect(page.locator('.card')).toHaveCount(2);
      await page.locator('.card').filter({ hasText: 'Delete Me A' }).locator('button:has-text("Delete")').click();
      await page.waitForSelector('.modal-content');
      await page.locator('.modal-content .btn-danger').click();
      await page.waitForTimeout(500);

      // A should be gone
      await expect(page.locator('.card')).toHaveCount(1);
      await expect(page.locator('.card h3').first()).toHaveText('Keep Me B');

      // B should still have its mesocycle and exercises
      await navigateTo(page, `/programs/${idB}`);
      await expect(page.locator('td:has-text("Meso B")')).toBeVisible();

      await navigateTo(page, `/programs/${idB}/exercises`);
      await expect(page.locator('.ex-item:has-text("Squat")')).toBeVisible();

      // Navigating to A should show not found
      await navigateTo(page, `/programs/${idA}`);
      await expect(page.locator('.empty-state')).toBeVisible();
    });
  });

  test.describe('ISO-3: Program backup and restore isolation', () => {
    test('restore A does not affect B', async ({ page }) => {
      await clearDatabase(page);

      // Setup A with initial data, export
      const idA = await seedProgramViaUI(page, 'Backup A');
      await addMesocycleViaUI(page, 'Block Alpha');
      await navigateTo(page, `/programs/${idA}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Press');

      // Export A
      await navigateTo(page, `/programs/${idA}/data`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download Program Backup")'),
      ]);
      const buffer = fs.readFileSync(await download.path());

      // Create B with its own data
      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Unchanged B');
      await addMesocycleViaUI(page, 'Block Beta');
      await navigateTo(page, `/programs/${idB}/exercises`);
      await addExerciseGroupViaUI(page, 'Back');
      await addExerciseToLibraryViaUI(page, 'Back', 'Pull');

      // Mutate A
      await navigateTo(page, `/programs/${idA}`);
      await addMesocycleViaUI(page, 'Block Gamma');

      // Restore A from backup
      await navigateTo(page, `/programs/${idA}/data`);
      await page.waitForTimeout(500);
      const fcPromise = page.waitForEvent('filechooser');
      await page.click('text=Restore Program Backup');
      const fc = await fcPromise;
      await fc.setFiles({ name: 'backup.sqlite', mimeType: 'application/octet-stream', buffer });
      await page.waitForSelector('.modal-content .btn-danger', { timeout: 5000 });
      await page.locator('.modal-content .btn-danger').click();
      await page.waitForTimeout(2000);

      // A should be back to original state (only Block Alpha)
      await navigateTo(page, `/programs/${idA}`);
      await expect(page.locator('td:has-text("Block Alpha")')).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(1);

      // B should be completely unchanged
      await navigateTo(page, `/programs/${idB}`);
      await expect(page.locator('td:has-text("Block Beta")')).toBeVisible();

      await navigateTo(page, `/programs/${idB}/exercises`);
      await expect(page.locator('.ex-item:has-text("Pull")')).toBeVisible();
    });
  });

  test.describe('ISO-4: Invalid program restore preserves data', () => {
    test('restoring backup into wrong program reports error', async ({ page }) => {
      await clearDatabase(page);

      // Create Program A and B with different names
      const idA = await seedProgramViaUI(page, 'Conflict A');
      await addMesocycleViaUI(page, 'Meso A');

      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Conflict B');
      await addMesocycleViaUI(page, 'Meso B');

      // Export A
      await navigateTo(page, `/programs/${idA}/data`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download Program Backup")'),
      ]);
      const buffer = fs.readFileSync(await download.path());

      // Navigate to B and try to restore A's backup (name conflict: A vs B)
      await navigateTo(page, `/programs/${idB}/data`);
      const fcPromise = page.waitForEvent('filechooser');
      await page.click('text=Restore Program Backup');
      const fc = await fcPromise;
      await fc.setFiles({ name: 'backup.sqlite', mimeType: 'application/octet-stream', buffer });
      await page.waitForSelector('.modal-content .btn-danger', { timeout: 5000 });
      await page.locator('.modal-content .btn-danger').click();
      await page.waitForTimeout(2000);

      // Should show error about name conflict
      await expect(page.locator('.alert-danger')).toBeVisible();
      await expect(page.locator('.alert-danger')).toContainText('conflicts');

      // B should still have its own data
      await navigateTo(page, `/programs/${idB}`);
      await expect(page.locator('td:has-text("Meso B")')).toBeVisible();
    });
  });

  test.describe('ISO-5: Legacy migration', () => {
    test('v2 data is migrated to isolated program stores', async ({ page }) => {
      // First navigate to the app so sql.js is loaded, then clear all IDB
      await clearDatabase(page);

      // Delete the migration marker and catalog that were just created,
      // then seed a synthetic v2 record so migration re-runs
      await page.evaluate(() => {
        const SQL = window.__sqlJs;

        const db = new SQL.Database();
        db.run(`
          CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
          INSERT INTO schema_version (version) VALUES (2);
          CREATE TABLE IF NOT EXISTS programs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), notes TEXT);
          CREATE TABLE IF NOT EXISTS mesocycles (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, name TEXT NOT NULL, microcycle_length INTEGER NOT NULL DEFAULT 7, start_date TEXT NOT NULL, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, mesocycle_id INTEGER NOT NULL, name TEXT NOT NULL, day_offset INTEGER NOT NULL, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS exercise_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, name TEXT NOT NULL, notes TEXT);
          CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_group_id INTEGER NOT NULL, name TEXT NOT NULL, tutorial_url TEXT, notes TEXT);
          CREATE TABLE IF NOT EXISTS exercise_variations (id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, name TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, tutorial_url TEXT, notes TEXT);
          CREATE TABLE IF NOT EXISTS workout_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, exercise_variation_id INTEGER, exercise_order INTEGER NOT NULL, set_number INTEGER NOT NULL, set_type TEXT NOT NULL DEFAULT 'normal', reps INTEGER, weight REAL, rir INTEGER, notes TEXT);
        `);

        db.run("INSERT INTO programs (id, name, notes, created_at) VALUES (1, 'Migrated Program', 'test notes', '2025-01-01T00:00:00Z')");
        db.run("INSERT INTO mesocycles (id, program_id, name, start_date, sort_order) VALUES (1, 1, 'Migrated Block', '2025-01-01', 0)");

        const v2data = db.export();
        db.close();

        return new Promise((resolve, reject) => {
          const req = indexedDB.open('workout-programming-v3', 1);
          req.onsuccess = (e) => {
            const idb = e.target.result;
            const tx = idb.transaction('databases', 'readwrite');
            const store = tx.objectStore('databases');
            store.delete('catalog-v1');
            store.delete('migration-v3-complete');
            store.put(v2data, 'v2');
            tx.oncomplete = () => { idb.close(); resolve(); };
            tx.onerror = (err) => reject(err.target.error);
          };
          req.onerror = (err) => reject(err.target.error);
        });
      });

      // Reload to trigger migration
      await navigateTo(page, '/');

      // The migrated program should appear
      await expect(page.locator('.card h3:has-text("Migrated Program")')).toBeVisible({ timeout: 10000 });

      // Navigate into the migrated program and verify data
      const card = page.locator('.card', { hasText: 'Migrated Program' });
      await card.locator('a:has-text("View")').click();
      await page.waitForSelector('.breadcrumb', { timeout: 5000 });
      await page.waitForTimeout(500);

      await expect(page.locator('td:has-text("Migrated Block")')).toBeVisible();

      // Reload and verify data is still there
      const url = page.url();
      await page.reload();
      await page.waitForSelector('.nav-bar', { timeout: 10000 });
      await page.waitForTimeout(500);

      await navigateTo(page, url);
      await page.waitForTimeout(300);
      await expect(page.locator('td:has-text("Migrated Block")')).toBeVisible();
    });
  });

  test.describe('ISO-6: Direct URL navigation', () => {
    test('navigating to nested mesocycle URL opens correct program', async ({ page }) => {
      await clearDatabase(page);

      const idA = await seedProgramViaUI(page, 'URL Test');
      await addMesocycleViaUI(page, 'Direct Block', 5);

      // Get the mesocycle ID from the page
      await page.locator('tr.hoverable-row').click();
      await page.waitForTimeout(500);
      const url = page.url();
      // URL should be /programs/:id/mesocycles/:mesoId

      // Reload at this URL
      await page.reload();
      await page.waitForSelector('.nav-bar', { timeout: 10000 });
      await page.waitForSelector('.day-cell, .empty-state', { timeout: 10000 });

      // Verify we're on the correct page
      await expect(page.locator('.breadcrumb')).toContainText('Direct Block');
      await expect(page.locator('.breadcrumb')).toContainText('URL Test');
    });

    test('invalid mesocycle ID in a valid program shows not found', async ({ page }) => {
      await clearDatabase(page);

      const idA = await seedProgramViaUI(page, 'Valid Program');
      await addMesocycleViaUI(page, 'Valid Block');

      // Navigate to a non-existent mesocycle ID in a valid program
      await navigateTo(page, `/programs/${idA}/mesocycles/99999`);
      await expect(page.locator('.empty-state')).toBeVisible();
    });
  });

  test.describe('ISO-7: Cross-program exercise copy', () => {
    test('copies exercises with variations between programs without sharing edits', async ({ page }) => {
      await clearDatabase(page);

      // Create source program with exercises
      const idA = await seedProgramViaUI(page, 'Source Program');
      await navigateTo(page, `/programs/${idA}/exercises`);
      await addExerciseGroupViaUI(page, 'Chest');
      await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');
      // Add a variation
      await page.locator('.ex-item-header').click();
      await page.waitForTimeout(300);
      await page.locator('.ex-item-detail input').fill('Close Grip');
      await page.locator('.ex-item-detail button:has-text("+")').click();
      await page.waitForTimeout(400);

      // Create target program
      await navigateTo(page, '/');
      const idB = await seedProgramViaUI(page, 'Target Program');
      await navigateTo(page, `/programs/${idB}/exercises`);
      await expect(page.locator('.ex-item')).toHaveCount(0);

      // Open copy modal
      await page.click('button:has-text("Copy from Program")');
      await page.waitForSelector('.modal-content');
      await page.locator('.modal-content select').selectOption('Source Program');
      await page.waitForTimeout(1500); // Wait for async data load

      // Select exercises
      const checkboxes = page.locator('.modal-content input[type="checkbox"]');
      await checkboxes.first().check();
      await page.waitForTimeout(300);

      // Copy
      await page.locator('button:has-text("Copy Selected")').click();
      await page.waitForTimeout(1500);

      // Verify exercises copied including group
      await expect(page.locator('.ex-item:has-text("Bench Press")')).toBeVisible();
      await expect(page.locator('.group-item:has-text("Chest")')).toBeVisible();

      // Verify variation was copied
      await page.locator('.ex-item-header').click();
      await page.waitForTimeout(300);
      await expect(page.locator('.ex-item-detail')).toContainText('Close Grip');

      // Modify copied exercise in target - add a new variation
      await page.locator('.ex-item-detail input').fill('Pause Rep');
      await page.locator('.ex-item-detail button:has-text("+")').click();
      await page.waitForTimeout(400);

      // Navigate to source - variation should NOT appear there
      await navigateTo(page, `/programs/${idA}/exercises`);
      await page.locator('.ex-item-header').click();
      await page.waitForTimeout(300);
      await expect(page.locator('.ex-item-detail')).not.toContainText('Pause Rep');
    });
  });
});
