import { test, expect } from '@playwright/test';
import { clearDatabase, createProgramViaUI, viewProgram } from './setup';

test.describe('Home Page — Programs', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('shows empty state when no programs exist', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state p')).toHaveText(/No programs yet/);
  });

  test('creates a new program via modal', async ({ page }) => {
    await createProgramViaUI(page, 'Push Pull Legs');
    await expect(page.locator('.card h3').first()).toHaveText('Push Pull Legs');
    await expect(page.locator('.card')).toHaveCount(1);
  });

  test('creates a program with notes', async ({ page }) => {
    await createProgramViaUI(page, '5/3/1 BBB', 'Wendler template');
    await expect(page.locator('.card h3').first()).toHaveText('5/3/1 BBB');
    await expect(page.locator('.card')).toContainText('Wendler template');
  });

  test('edits an existing program', async ({ page }) => {
    await createProgramViaUI(page, 'Old Name');
    await page.locator('button:has-text("Edit")').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content input[required]').fill('Updated Name');
    await page.locator('.modal-content button:has-text("Save")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.card h3').first()).toHaveText('Updated Name');
  });

  test('deletes a program with confirmation dialog', async ({ page }) => {
    await createProgramViaUI(page, 'Delete Me');
    await expect(page.locator('.card')).toHaveCount(1);
    await page.locator('button:has-text("Delete")').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-danger').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('cancels delete when dialog is dismissed', async ({ page }) => {
    await createProgramViaUI(page, 'Keep Me');
    await page.locator('button:has-text("Delete")').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-outline').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.card h3').first()).toHaveText('Keep Me');
  });

  test('navigates to program page on View click', async ({ page }) => {
    await createProgramViaUI(page, 'View Test');
    await viewProgram(page, 'View Test');
    await expect(page.locator('.breadcrumb')).toContainText('View Test');
    await expect(page).toHaveURL(/\/programs\//);
  });

  test('can create multiple programs', async ({ page }) => {
    await createProgramViaUI(page, 'Program A');
    await createProgramViaUI(page, 'Program B');
    await createProgramViaUI(page, 'Program C');
    await expect(page.locator('.card')).toHaveCount(3);
  });

  test('confirmation modal text is readable on dark background', async ({ page }) => {
    await createProgramViaUI(page, 'Readability Test');
    await page.locator('button:has-text("Delete")').click();
    await page.waitForSelector('.modal-content');

    const [fg, ref] = await page.locator('.modal-content').evaluate((el) => {
      const fg = getComputedStyle(el).color;
      const probe = document.createElement('span');
      probe.style.color = 'var(--text)';
      el.appendChild(probe);
      const ref = getComputedStyle(probe).color;
      probe.remove();
      return [fg, ref];
    });
    await expect(fg).toBe(ref);
  });

  test('closes modal when clicking Cancel', async ({ page }) => {
    await page.click('button:has-text("+ New Program")');
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content button:has-text("Cancel")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.modal-content')).toHaveCount(0);
  });
});
