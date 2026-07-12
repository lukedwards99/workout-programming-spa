import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI,
} from './setup';
import * as fs from 'node:fs';

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
