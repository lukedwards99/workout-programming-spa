import { test, expect } from '@playwright/test';
import { clearDatabase, navigateTo, createProgramViaUI, viewProgram, addMesocycleViaUI } from './setup';
import path from 'path';
import fs from 'fs';

test.describe('Data Management', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    // Seed some data so stats are non-zero
    await createProgramViaUI(page, 'Stats Program');
    await viewProgram(page, 'Stats Program');
    await addMesocycleViaUI(page, 'Stats Block', 7);

    await navigateTo(page, '/data');
  });

  test('displays non-zero stats after seeding data', async ({ page }) => {
    await expect(page.locator('.stat-card').filter({ hasText: 'Programs' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Mesocycles' }).locator('.val')).toHaveText('1');
  });

  test('exports database as .sqlite file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Backup")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/workout-data-backup-.*\.sqlite/);
  });

  test('exported file is not empty', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Backup")'),
    ]);

    const tempPath = await download.path();
    expect(tempPath).toBeTruthy();
    const stat = fs.statSync(tempPath);
    expect(stat.size).toBeGreaterThan(100);
  });

  test('import rejects non-sqlite file', async ({ page }) => {
    // Create a text file
    const txtContent = Buffer.from('This is not a SQLite file');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'not-sqlite.txt',
      mimeType: 'text/plain',
      buffer: txtContent,
    });
    await page.waitForTimeout(500);

    await expect(page.locator('.alert-danger')).toContainText('Invalid file type');
  });

  test('import shows confirmation before replacing data', async ({ page }) => {
    // First export the current database
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Backup")'),
    ]);
    const tempPath = await download.path();
    const buffer = fs.readFileSync(tempPath);

    // Now import it back
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer,
    });
    await page.waitForTimeout(500);

    // Confirmation should appear
    await expect(page.locator('.alert-warning')).toBeVisible();
    await expect(page.locator('button:has-text("Yes, Replace My Data")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('cancels import when Cancel is clicked', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Backup")'),
    ]);
    const tempPath = await download.path();
    const buffer = fs.readFileSync(tempPath);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.file-drop-zone').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer,
    });
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    // Confirmation should be gone
    await expect(page.locator('button:has-text("Yes, Replace My Data")')).toHaveCount(0);
  });

  test('delete all data shows confirmation and clears', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Delete All Data")');
    await page.waitForTimeout(800);

    // Stats should be zero now
    await page.reload();
    await page.waitForSelector('.nav-bar', { timeout: 10000 });
    await navigateTo(page, '/data');

    await expect(page.locator('.stat-card').filter({ hasText: 'Programs' }).locator('.val')).toHaveText('0');
    await expect(page.locator('.stat-card').filter({ hasText: 'Mesocycles' }).locator('.val')).toHaveText('0');
  });
});
