import { test, expect } from '@playwright/test';
import { clearDatabase, navigateTo } from './setup';

test.describe('Tutorial', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);
  });

  test('tutorial page renders with content', async ({ page }) => {
    await navigateTo(page, '/tutorial');
    await expect(page.locator('h1')).toHaveText('Getting Started with LiftLog');
    await expect(page.locator('button:has-text("Create Sample Program")')).toBeVisible();
  });

  test('home page empty state links to tutorial', async ({ page }) => {
    await navigateTo(page, '/');
    await expect(page.locator('.empty-state p').nth(1)).toContainText('Not sure where to start');
    await page.click('a:has-text("Check out the tutorial")');
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toHaveText('Getting Started with LiftLog');
  });

  test('creates sample program via tutorial', async ({ page }) => {
    await navigateTo(page, '/tutorial');
    await page.click('button:has-text("Create Sample Program")');
    await page.waitForTimeout(500);

    // Should show success with link
    await expect(page.locator('.alert-success')).toContainText('Getting Started');

    // Click to open the program
    await page.click('a:has-text("Open program")');
    await page.waitForTimeout(500);

    // Should be on the program page
    await expect(page.locator('.breadcrumb')).toContainText('Getting Started');

    // Should have the Foundation Block mesocycle
    await expect(page.locator('tbody')).toContainText('Foundation Block');

    // Navigate to mesocycle to verify workouts
    await page.locator('tr', { hasText: 'Foundation Block' }).click();
    await page.waitForTimeout(500);

    // Should have workouts on days 0, 2, 4
    await expect(page.locator('.workout-chip')).toHaveCount(3);
    await expect(page.locator('.workout-chip').first()).toContainText('Push Day');

    // Each exercise/variation block starts its own set numbering.
    await page.locator('.workout-chip', { hasText: 'Push Day' }).click();
    await page.waitForSelector('.exercise-block');
    const closeGripBlock = page.locator('.exercise-block', { hasText: 'Close Grip' });
    await expect(closeGripBlock.locator('td[data-label="Set"]').first()).toHaveText('1');

    // Navigate to Summary tab to verify stats
    await page.locator('.program-tabs button').filter({ hasText: 'Summary' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.stats-grid')).toBeVisible();
    // Should have non-zero working sets
    const wsVal = page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val');
    await expect(wsVal).not.toHaveText('0');
  });

  test('burger menu opens and navigates to about', async ({ page }) => {
    await navigateTo(page, '/');
    await page.click('.burger-btn');
    await expect(page.locator('.burger-dropdown')).toBeVisible();
    await page.click('.burger-dropdown a:has-text("About")');
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toHaveText('About LiftLog');
  });

  test('burger menu opens and navigates to tutorial', async ({ page }) => {
    await navigateTo(page, '/');
    await page.click('.burger-btn');
    await expect(page.locator('.burger-dropdown')).toBeVisible();
    await page.click('.burger-dropdown a:has-text("Tutorial")');
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toHaveText('Getting Started with LiftLog');
  });

  test('burger menu closes on backdrop click', async ({ page }) => {
    await navigateTo(page, '/');
    await page.click('.burger-btn');
    await expect(page.locator('.burger-dropdown')).toBeVisible();
    await page.click('.burger-backdrop');
    await page.waitForTimeout(300);
    await expect(page.locator('.burger-dropdown')).toHaveCount(0);
  });

  test('about page renders content', async ({ page }) => {
    await navigateTo(page, '/about');
    await expect(page.locator('h1')).toHaveText('About LiftLog');
    await expect(page.locator('.data-card')).toHaveCount(3);
  });
});
