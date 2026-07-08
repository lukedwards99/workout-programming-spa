import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, createProgramViaUI, viewProgram,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI,
} from './setup';
import fs from 'fs';

test.describe('Import/Export Round-Trip', () => {
  test('full round-trip: export → delete all → import → verify', async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);

    // Step 1: Seed meaningful data through the UI
    // Create a program
    await createProgramViaUI(page, 'Round Trip Program', 'Test notes');
    await viewProgram(page, 'Round Trip Program');

    // Create a mesocycle
    await addMesocycleViaUI(page, 'Block A', 5);
    await page.waitForTimeout(500);

    // Go to exercises page and create group + exercise
    await navigateTo(page, '/exercises');
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Arms');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Arms');
    await page.locator('.modal-box input[required]').fill('Bicep Curl');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Step 2: Export the database
    await navigateTo(page, '/data');
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Backup")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.sqlite$/);
    const tempPath = await download.path();
    const exportedData = fs.readFileSync(tempPath);
    expect(exportedData.length).toBeGreaterThan(200);

    // Step 3: Delete all data
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Delete All Data")');
    await page.waitForTimeout(1000);

    // Verify data is gone
    await page.waitForTimeout(500);
    await navigateTo(page, '/');
    await expect(page.locator('.empty-state')).toBeVisible();

    // Verify exercises are gone
    await navigateTo(page, '/exercises');
    await page.waitForTimeout(500);
    await expect(page.locator('.ex-item').first()).toHaveCount(0);

    // Step 4: Import the file
    await navigateTo(page, '/data');
    await page.waitForTimeout(500);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer: exportedData,
    });
    await page.waitForTimeout(500);

    // Click confirm
    await page.locator('button:has-text("Yes, Replace My Data")').click();
    await page.waitForTimeout(2000);

    // Step 5: Reload and verify everything is restored
    await navigateTo(page, '/');
    await page.waitForTimeout(500);

    // Program should be back
    await expect(page.locator('.card h3').first()).toHaveText('Round Trip Program');

    // Mesocycle should be back
    await viewProgram(page, 'Round Trip Program');
    await page.waitForTimeout(300);
    await expect(page.locator('tr', { hasText: 'Block A' })).toBeVisible();

    // Exercise should be back
    await navigateTo(page, '/exercises');
    await page.waitForTimeout(500);
    await expect(page.locator('.ex-item').filter({ hasText: 'Bicep Curl' })).toBeVisible();
  });
});
