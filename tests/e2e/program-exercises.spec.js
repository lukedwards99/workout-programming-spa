import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
} from './setup';

test.describe('Program Exercises Page', () => {
  let programId;

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    const id = await seedProgramViaUI(page, 'Exercise Test');
    programId = id;
    await navigateTo(page, `/programs/${id}/exercises`);
  });

  test('shows empty sidebar when no groups exist', async ({ page }) => {
    await expect(page.locator('.group-item').first()).toHaveText(/All Exercises/);
  });

  test('creates a new exercise group', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Chest');
    await expect(page.locator('.group-item').filter({ hasText: 'Chest' })).toBeVisible();
  });

  test('creates multiple groups', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseGroupViaUI(page, 'Back');
    await expect(page.locator('.group-item').filter({ hasText: 'Chest' })).toBeVisible();
    await expect(page.locator('.group-item').filter({ hasText: 'Back' })).toBeVisible();
  });

  test('adds an exercise to a group', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Legs');
    await addExerciseToLibraryViaUI(page, 'Legs', 'Barbell Squat');
    await expect(page.locator('.ex-item').filter({ hasText: 'Barbell Squat' })).toBeVisible();
  });

  test('adds exercise with notes', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Back');
    await addExerciseToLibraryViaUI(page, 'Back', 'Deadlift', 'Keep back straight');
    await expect(page.locator('.ex-item').filter({ hasText: 'Deadlift' })).toBeVisible();
    await expect(page.locator('.ex-item-meta').first()).toContainText('Keep back straight');
  });

  test('filters exercises by group selection', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseGroupViaUI(page, 'Back');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');
    await addExerciseToLibraryViaUI(page, 'Back', 'Pull-Up');

    await page.locator('.group-item').filter({ hasText: 'Chest' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Pull-Up' })).toHaveCount(0);

    await page.locator('.group-item').filter({ hasText: 'Back' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.ex-item').filter({ hasText: 'Pull-Up' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Bench Press' })).toHaveCount(0);
  });

  test('searches exercises by name', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Shoulders');
    await addExerciseToLibraryViaUI(page, 'Shoulders', 'Lateral Raise');
    await addExerciseToLibraryViaUI(page, 'Shoulders', 'Front Raise');

    await page.locator('.search-input').fill('Lateral');
    await page.waitForTimeout(300);
    await expect(page.locator('.ex-item').filter({ hasText: 'Lateral Raise' })).toBeVisible();
    await expect(page.locator('.ex-item').filter({ hasText: 'Front Raise' })).toHaveCount(0);

    await page.locator('.search-input').fill('');
    await page.waitForTimeout(300);
    await expect(page.locator('.ex-item')).toHaveCount(2);
  });

  test('adds a variation to an exercise', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

    await page.locator('.ex-item-header').click();
    await page.waitForTimeout(300);

    await page.locator('.ex-item-detail input').fill('Close Grip');
    await page.locator('.ex-item-detail button:has-text("+")').click();
    await page.waitForTimeout(400);

    await expect(page.locator('.ex-item-detail .var-item')).toContainText('Close Grip');
    await expect(page.locator('.ex-item-detail .var-item')).toContainText('primary');
  });

  test('deletes an exercise', async ({ page }) => {
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Delete Me');

    await page.locator('.ex-item').filter({ hasText: 'Delete Me' }).locator('button:has-text("Del")').click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-danger').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.ex-item').filter({ hasText: 'Delete Me' })).toHaveCount(0);
  });
});
