import { test, expect } from '@playwright/test';
import { clearDatabase, navigateTo } from './setup';

test.describe('Exercise Library', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);
    await navigateTo(page, '/exercises');
  });

  test('shows empty sidebar when no groups exist', async ({ page }) => {
    await expect(page.locator('.group-item').first()).toHaveText(/All Exercises/);
  });

  test('creates a new exercise group', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.group-item').filter({ hasText: 'Chest' })).toBeVisible();
  });

  test('creates multiple groups', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Back');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.group-item').filter({ hasText: 'Chest' })).toBeVisible();
    await expect(page.locator('.group-item').filter({ hasText: 'Back' })).toBeVisible();
  });

  test('adds an exercise to a group', async ({ page }) => {
    // Create group first
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Legs');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Add exercise
    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Legs');
    await page.locator('.modal-box input[required]').fill('Barbell Squat');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.ex-item').filter({ hasText: 'Barbell Squat' })).toBeVisible();
  });

  test('adds exercise with notes', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Back');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Back');
    await page.locator('.modal-box input[required]').fill('Deadlift');
    await page.locator('.modal-box textarea').fill('Keep back straight');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.ex-item').filter({ hasText: 'Deadlift' })).toBeVisible();
    await expect(page.locator('.ex-item-meta').first()).toContainText('Keep back straight');
  });

  test('filters exercises by group selection', async ({ page }) => {
    // Create two groups
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Back');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Add exercise to Chest
    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Chest');
    await page.locator('.modal-box input[required]').fill('Bench Press');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Add exercise to Back
    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Back');
    await page.locator('.modal-box input[required]').fill('Pull-Up');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Filter by Chest
    await page.locator('.group-item').filter({ hasText: 'Chest' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Pull-Up' })).toHaveCount(0);

    // Filter by Back
    await page.locator('.group-item').filter({ hasText: 'Back' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('.ex-item').filter({ hasText: 'Pull-Up' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toHaveCount(0);
  });

  test('searches exercises by name', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Shoulders');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Shoulders');
    await page.locator('.modal-box input[required]').fill('Lateral Raise');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Shoulders');
    await page.locator('.modal-box input[required]').fill('Front Raise');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Search
    await page.locator('.search-input').fill('Lateral');
    await page.waitForTimeout(300);

    await expect(page.locator('.ex-item').filter({ hasText: 'Lateral Raise' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Front Raise' })).toHaveCount(0);

    // Clear search
    await page.locator('.search-input').fill('');
    await page.waitForTimeout(300);
    await expect(page.locator('.ex-item')).toHaveCount(2);
  });

  test('adds a variation to an exercise', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Chest');
    await page.locator('.modal-box input[required]').fill('Bench Press');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    // Expand exercise
    await page.locator('.ex-item-header').click();
    await page.waitForTimeout(300);

    // Add variation
    await page.locator('.ex-item-detail input').fill('Close Grip');
    await page.locator('.ex-item-detail button:has-text("+")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.ex-item-detail .var-item')).toContainText('Close Grip');
    await expect(page.locator('.ex-item-detail .var-item')).toContainText('primary');
  });

  test('deletes an exercise', async ({ page }) => {
    await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box input[required]').fill('Chest');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    await page.click('button:has-text("+ Add Exercise")');
    await page.waitForSelector('.modal-box');
    await page.locator('.modal-box select').selectOption('Chest');
    await page.locator('.modal-box input[required]').fill('Delete Me');
    await page.locator('.modal-box button:has-text("Save")').click();
    await page.waitForTimeout(400);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.ex-item').filter({ hasText: 'Delete Me' }).locator('button:has-text("Del")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.ex-item').filter({ hasText: 'Delete Me' })).toHaveCount(0);
  });
});
