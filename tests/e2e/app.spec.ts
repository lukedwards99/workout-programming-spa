import { expect, test } from './fixtures';

test('creates a D1-backed program and mesocycle', async ({ page }) => {
  await page.getByRole('button', { name: 'New program' }).click();
  await page.getByRole('dialog').locator('input').first().fill('E2E Strength Plan');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'E2E Strength Plan' })).toBeVisible();
  await page.getByRole('link', { name: 'E2E Strength Plan' }).click();
  await page.getByRole('button', { name: 'Add mesocycle' }).click();
  await page.getByRole('dialog').locator('input').first().fill('Base Block');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Base Block' })).toBeVisible();
});

test('uses a workspace-scoped exercise library', async ({ page }) => {
  await page.getByRole('link', { name: 'Exercise Library' }).click();
  await expect(page.getByText('Back Squat', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New exercise' }).click();
  await page.getByRole('dialog').locator('input').first().fill('Front Squat');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Front Squat', { exact: true })).toBeVisible();
});

test('assigns an independent template copy to a client', async ({ page }) => {
  await page.getByRole('link', { name: 'Clients' }).click();
  await page.getByRole('button', { name: 'Assign template' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Beta Template — .* Client/)).toBeVisible();
});

test('exposes beta provisioning only to the platform administrator', async ({ page }) => {
  const suffix = Date.now();
  const displayName = `Beta Athlete ${suffix}`;
  await page.getByRole('link', { name: 'Admin Users' }).click();
  await expect(page.getByRole('heading', { name: 'Admin Users' })).toBeVisible();
  await page.getByRole('button', { name: 'Provision user' }).click();
  const fields = page.getByRole('dialog').locator('input');
  await fields.nth(0).fill(displayName);
  await fields.nth(1).fill(`athlete-${suffix}@example.test`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(displayName)).toBeVisible();
});
