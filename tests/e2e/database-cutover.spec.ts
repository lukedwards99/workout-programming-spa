import { test, expect } from '@playwright/test';
import { clearDatabase, waitForApp } from './setup';

test.describe('Clean database cutover', () => {
  test('ignores and preserves the legacy IndexedDB namespace', async ({ page }) => {
    await waitForApp(page);

    const legacyBytes = [9, 8, 7, 6];
    await page.evaluate(async (bytes) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('workout-programming-v5', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('databases')) {
            database.createObjectStore('databases');
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('databases', 'readwrite');
          transaction.objectStore('databases').put(new Uint8Array(bytes), 'catalog-v1');
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    }, legacyBytes);

    await page.reload();
    await page.waitForSelector('.nav-bar');
    await clearDatabase(page);
    await expect(page.locator('.card')).toHaveCount(0);

    const result = await page.evaluate(async () => {
      const names = (await indexedDB.databases()).map((database) => database.name);
      const value = await new Promise<Uint8Array | undefined>((resolve, reject) => {
        const request = indexedDB.open('workout-programming-v5', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('databases', 'readonly');
          const getRequest = transaction.objectStore('databases').get('catalog-v1');
          getRequest.onsuccess = () => {
            database.close();
            resolve(getRequest.result as Uint8Array | undefined);
          };
          getRequest.onerror = () => reject(getRequest.error);
        };
      });
      return { names, bytes: value ? Array.from(value) : null };
    });

    expect(result.names).toContain('workout-programming-v7');
    expect(result.names).toContain('workout-programming-v5');
    expect(result.bytes).toEqual(legacyBytes);
  });
});
