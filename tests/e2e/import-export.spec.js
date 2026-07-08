import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI,
} from './setup';
import fs from 'fs';

test.describe('Import/Export Round-Trip', () => {
  test('full round-trip: export exercises → clear → new program → import → verify', async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);

    const idA = await seedProgramViaUI(page, 'Program A');
    await addMesocycleViaUI(page, 'Block A', 5);
    await page.waitForTimeout(500);

    await navigateTo(page, `/programs/${idA}/exercises`);
    await addExerciseGroupViaUI(page, 'Arms');
    await addExerciseToLibraryViaUI(page, 'Arms', 'Bicep Curl');
    await addExerciseToLibraryViaUI(page, 'Arms', 'Tricep Extension');

    await navigateTo(page, `/programs/${idA}/data`);
    await page.waitForTimeout(500);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.json$/);
    const tempPath = await download.path();
    const exportedData = fs.readFileSync(tempPath);
    expect(exportedData.length).toBeGreaterThan(100);

    await clearDatabase(page);
    const idB = await seedProgramViaUI(page, 'Program B');
    await page.waitForTimeout(500);

    await navigateTo(page, `/programs/${idB}/exercises`);
    await page.waitForTimeout(500);
    await expect(page.locator('.ex-item').first()).toHaveCount(0);

    await navigateTo(page, `/programs/${idB}/data`);
    await page.waitForTimeout(500);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'program-export.json', mimeType: 'application/json', buffer: exportedData });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Import Exercises")');
    await page.waitForTimeout(1000);

    await navigateTo(page, `/programs/${idB}/exercises`);
    await page.waitForTimeout(500);
    await expect(page.locator('.ex-item').filter({ hasText: 'Bicep Curl' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Tricep Extension' })).toBeVisible();
    await expect(page.locator('.group-item').filter({ hasText: 'Arms' })).toBeVisible();

    await navigateTo(page, '/');
    await page.waitForTimeout(300);
    await expect(page.locator('.card')).toHaveCount(1);
    await expect(page.locator('.card h3').first()).toHaveText('Program B');
  });
});
