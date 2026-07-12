import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
} from './setup';
import * as fs from 'node:fs';

test.describe('Program Data Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);

    const programId = await seedProgramViaUI(page, 'Data Test Program');
    await navigateTo(page, `/programs/${programId}/exercises`);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');
    await navigateTo(page, `/programs/${programId}/data`);
  });

  test('displays exercise library stats after seeding data', async ({ page }) => {
    await expect(page.locator('.stat-card').filter({ hasText: 'Exercises' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Groups' }).locator('.val')).toHaveText('1');
  });

  test('exports exercises as .json file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('exported .json file is not empty', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);
    const tempPath = await download.path();
    expect(tempPath).toBeTruthy();
    const stat = fs.statSync(tempPath);
    expect(stat.size).toBeGreaterThan(50);
  });

  test('exports program backup as .sqlite file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Program Backup")'),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.sqlite$/);
  });

  test('import rejects non-json file', async ({ page }) => {
    const txtContent = Buffer.from('This is not a JSON file');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'not-json.txt', mimeType: 'text/plain', buffer: txtContent });
    await page.waitForTimeout(500);
    await expect(page.locator('.alert-danger')).toContainText('Invalid file type');
  });

  test('import shows confirmation before importing', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);
    const tempPath = await download.path();
    const buffer = fs.readFileSync(tempPath);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'program-export.json', mimeType: 'application/json', buffer });
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("Import Exercises")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")').last()).toBeVisible();
  });

  test('cancels import when Cancel is clicked', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);
    const tempPath = await download.path();
    const buffer = fs.readFileSync(tempPath);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'program-export.json', mimeType: 'application/json', buffer });
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Cancel")').last().click();
    await page.waitForTimeout(300);
    await expect(page.locator('button:has-text("Import Exercises")')).toHaveCount(0);
  });

  test('imports exercises from a .json export', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Exercises")'),
    ]);
    const tempPath = await download.path();
    const buffer = fs.readFileSync(tempPath);

    await clearDatabase(page);
    const newId = await seedProgramViaUI(page, 'Fresh Program');
    await navigateTo(page, `/programs/${newId}/data`);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'program-export.json', mimeType: 'application/json', buffer });
    await page.waitForTimeout(500);

    await page.click('button:has-text("Import Exercises")');
    await page.waitForTimeout(1000);

    await navigateTo(page, `/programs/${newId}/exercises`);
    await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toBeVisible();
  });
});
