import { test, expect, type Page } from '@playwright/test';
import initSqlJs from 'sql.js';
import { clearDatabase, navigateTo, seedProgramViaUI } from './setup';

interface FolderTestWindow extends Window {
  __denyBackupPermission?: boolean;
  __failBackupWrite?: boolean;
}

async function installOpfsDirectoryPicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const testWindow = window as FolderTestWindow;
    testWindow.__denyBackupPermission = false;
    testWindow.__failBackupWrite = false;

    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        const storage = navigator.storage as StorageManager & {
          getDirectory(): Promise<FileSystemDirectoryHandle>;
        };
        return storage.getDirectory();
      },
    });

    if (typeof FileSystemHandle !== 'undefined') {
      const handlePrototype = FileSystemHandle.prototype as FileSystemHandle & {
        queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
        requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
      };
      const originalQuery = handlePrototype.queryPermission;
      const originalRequest = handlePrototype.requestPermission;
      Object.defineProperty(handlePrototype, 'queryPermission', {
        configurable: true,
        value: async function (descriptor: { mode: 'readwrite' }) {
          if ((window as FolderTestWindow).__denyBackupPermission) return 'denied';
          return originalQuery ? originalQuery.call(this, descriptor) : 'granted';
        },
      });
      Object.defineProperty(handlePrototype, 'requestPermission', {
        configurable: true,
        value: async function (descriptor: { mode: 'readwrite' }) {
          if ((window as FolderTestWindow).__denyBackupPermission) return 'denied';
          return originalRequest ? originalRequest.call(this, descriptor) : 'granted';
        },
      });
    }

    if (typeof FileSystemDirectoryHandle !== 'undefined') {
      const directoryPrototype = FileSystemDirectoryHandle.prototype;
      const originalGetFileHandle = directoryPrototype.getFileHandle;
      Object.defineProperty(directoryPrototype, 'getFileHandle', {
        configurable: true,
        value: async function (name: string, options?: FileSystemGetFileOptions) {
          if ((window as FolderTestWindow).__failBackupWrite) {
            throw new DOMException('Test write failure', 'NotAllowedError');
          }
          return originalGetFileHandle.call(this, name, options);
        },
      });
    }
  });
}

async function readOpfsBackups(page: Page): Promise<{ names: string[]; bytes: number[] }> {
  return page.evaluate(async () => {
    const storage = navigator.storage as StorageManager & {
      getDirectory(): Promise<FileSystemDirectoryHandle>;
    };
    const root = await storage.getDirectory();
    const names: string[] = [];
    for await (const name of (root as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> }).keys()) {
      if (name.endsWith('.sqlite')) names.push(name);
    }
    names.sort();
    if (names.length === 0) return { names, bytes: [] };
    const file = await (await root.getFileHandle(names[0])).getFile();
    return {
      names,
      bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
    };
  });
}

async function parseBackupMetadata(bytes: number[]): Promise<Record<string, string>> {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(bytes));
  const rows = db.exec('SELECT key, value FROM backup_metadata');
  db.close();
  return Object.fromEntries((rows[0]?.values || []).map(([key, value]) => [String(key), String(value)]));
}

test.describe('User-managed backup folder', () => {
  test.beforeEach(async ({ page }) => {
    await installOpfsDirectoryPicker(page);
    await clearDatabase(page);
  });

  test('persists the folder and overwrites one stable file after a program rename', async ({ page }) => {
    const programId = await seedProgramViaUI(page, 'Folder Backup Program');
    await navigateTo(page, `/programs/${programId}/data`);

    await expect(page.getByRole('button', { name: 'Back Up to Folder' })).toBeDisabled();
    await page.getByRole('button', { name: 'Choose Backup Folder' }).click();
    await expect(page.getByText(/Connected folder:/)).toBeVisible();
    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-success')).toContainText('Program backup saved as');

    const firstBackup = await readOpfsBackups(page);
    expect(firstBackup.names).toHaveLength(1);
    expect(new TextDecoder().decode(new Uint8Array(firstBackup.bytes).slice(0, 16))).toContain('SQLite format 3');
    const metadata = await parseBackupMetadata(firstBackup.bytes);
    expect(metadata.folder_backup_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(metadata.folder_backup_filename).toBe(firstBackup.names[0]);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Change Backup Folder' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back Up to Folder' })).toBeEnabled();

    await navigateTo(page, '/');
    const card = page.locator('.card', { hasText: 'Folder Backup Program' });
    await card.getByRole('button', { name: 'Edit' }).click();
    await page.locator('.modal-content input[required]').fill('Renamed Folder Program');
    await page.locator('.modal-content').getByRole('button', { name: 'Save' }).click();
    await navigateTo(page, `/programs/${programId}/data`);
    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-success')).toContainText(firstBackup.names[0]);

    const secondBackup = await readOpfsBackups(page);
    expect(secondBackup.names).toEqual(firstBackup.names);
  });

  test('restoring a folder backup adopts its filename on a new local program', async ({ page }) => {
    const originalId = await seedProgramViaUI(page, 'Portable Program');
    await navigateTo(page, `/programs/${originalId}/data`);
    await page.getByRole('button', { name: 'Choose Backup Folder' }).click();
    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-success')).toContainText('Program backup saved as');
    const originalBackup = await readOpfsBackups(page);

    await clearDatabase(page);
    const restoredId = await seedProgramViaUI(page, 'Restore Target');
    await navigateTo(page, `/programs/${restoredId}/data`);
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Restore Program Backup' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: originalBackup.names[0],
      mimeType: 'application/x-sqlite3',
      buffer: Buffer.from(originalBackup.bytes),
    });
    await page.locator('.modal-content').getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.alert-success')).toContainText('Program restored from backup');

    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-success')).toContainText(originalBackup.names[0]);
    expect((await readOpfsBackups(page)).names).toEqual(originalBackup.names);
  });

  test('reports denied permission and write failures while preserving download fallback', async ({ page }) => {
    const programId = await seedProgramViaUI(page, 'Failure Program');
    await navigateTo(page, `/programs/${programId}/data`);
    await page.getByRole('button', { name: 'Choose Backup Folder' }).click();
    await expect(page.getByRole('button', { name: 'Back Up to Folder' })).toBeEnabled();

    await page.evaluate(() => { (window as FolderTestWindow).__denyBackupPermission = true; });
    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-danger')).toContainText('access was denied');

    await page.evaluate(() => {
      const testWindow = window as FolderTestWindow;
      testWindow.__denyBackupPermission = false;
      testWindow.__failBackupWrite = true;
    });
    await page.getByRole('button', { name: 'Change Backup Folder' }).click();
    await expect(page.getByRole('button', { name: 'Back Up to Folder' })).toBeEnabled();
    await page.getByRole('button', { name: 'Back Up to Folder' }).click();
    await expect(page.locator('.alert-danger')).toContainText('no longer available');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Program Backup' }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/\.sqlite$/);
  });

  test('picker cancellation keeps the page usable without an error alert', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => { throw new DOMException('Cancelled', 'AbortError'); },
      });
    });
    await page.reload();
    const programId = await seedProgramViaUI(page, 'Cancellation Program');
    await navigateTo(page, `/programs/${programId}/data`);

    await page.getByRole('button', { name: 'Choose Backup Folder' }).click();
    await expect(page.locator('.alert-danger')).toHaveCount(0);
    await expect(page.getByText('No backup folder selected.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Program Backup' })).toBeEnabled();
  });

  test('shows the download fallback when folder access is unsupported', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: undefined,
      });
    });
    await page.reload();
    const programId = await seedProgramViaUI(page, 'Fallback Program');
    await navigateTo(page, `/programs/${programId}/data`);

    await expect(page.getByText(/Direct folder backups are not supported/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose Backup Folder' })).toHaveCount(0);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Program Backup' }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/\.sqlite$/);
  });
});
