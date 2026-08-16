import { expect, test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeVisible();
    await use(page);
  },
});

export { expect };
