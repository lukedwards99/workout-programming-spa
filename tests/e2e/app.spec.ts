import { expect, test } from './fixtures';

test('creates a D1-backed program and mesocycle', async ({ page }) => {
  await page.getByRole('button', { name: 'New program' }).click();
  await page.getByRole('dialog').locator('input').first().fill('E2E Strength Plan');
  await page.getByRole('button', { name: 'Save' }).click();
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

test('copies an independent program with executed values off by default', async ({ page, personas }) => {
  await page.goto(`/programs/${personas.programId}`);
  await page.getByRole('button', { name: 'Copy program' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Include executed values/)).not.toBeChecked();
  await dialog.locator('input').first().fill('Independent Copy');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Independent Copy' })).toBeVisible();
});

test('creates, switches to, and deletes a workspace', async ({ page }) => {
  const name = `E2E Workspace ${Date.now()}`;
  await page.getByRole('link', { name: 'Workspaces' }).click();
  await page.getByPlaceholder('Workspace name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  const card = page.locator('article').filter({ hasText: name });
  await expect(card.getByText(/selected/)).toBeVisible();
  await card.locator('input').fill(name);
  await card.getByRole('button', { name: 'Delete' }).click();
  await expect(card).toHaveCount(0);
});

test('provisions a beta user only inside isolated E2E state', async ({ page }) => {
  const suffix = Date.now(), displayName = `Beta Athlete ${suffix}`;
  await page.getByRole('link', { name: 'Admin Users' }).click();
  await page.getByRole('button', { name: 'Provision user' }).click();
  const fields = page.getByRole('dialog').locator('input');
  await fields.nth(0).fill(displayName); await fields.nth(1).fill(`athlete-${suffix}@example.test`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(displayName)).toBeVisible();
});
