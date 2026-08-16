import { test, expect } from './fixtures';
import * as fs from 'node:fs';
import {
  addExerciseGroupViaUI,
  addExerciseToLibraryViaUI,
  addExerciseViaUI,
  addMesocycleViaUI,
  addWorkoutViaUI,
  copyWorkout,
  flushPersistence,
  navigateTo,
  openWorkout,
  seedProgramViaUI,
  viewMesocycle,
} from './setup';

test.describe('Cardio exercise programming', () => {
  let programId: number;

  test.beforeEach(async ({ page }) => {
    programId = (await seedProgramViaUI(page, 'Mixed Training'))!;

    await navigateTo(page, `/programs/${programId}/exercises`);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');
    await addExerciseGroupViaUI(page, 'Conditioning');
    await addExerciseToLibraryViaUI(page, 'Conditioning', 'Running', '', '', 'cardio');

    await navigateTo(page, `/programs/${programId}`);
    await addMesocycleViaUI(page, 'Base Block', 14);
    await viewMesocycle(page, 'Base Block');
    await addWorkoutViaUI(page, 0, 'Mixed Day');
    await openWorkout(page, 'Mixed Day');
  });

  test('classifies and filters cardio exercises in the library', async ({ page }) => {
    await navigateTo(page, `/programs/${programId}/exercises`);

    const running = page.locator('.ex-item', { hasText: 'Running' });
    await expect(running).toContainText('Cardio');

    await page.getByRole('button', { name: 'Cardio', exact: true }).first().click();
    await expect(page.locator('.ex-item')).toHaveCount(1);
    await expect(running).toBeVisible();

    await page.getByRole('button', { name: 'Strength', exact: true }).first().click();
    await expect(page.locator('.ex-item')).toHaveCount(1);
    await expect(page.locator('.ex-item')).toContainText('Bench Press');
  });

  test('programs, edits, reorders, and persists cardio sets alongside strength', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await addExerciseViaUI(page, 'Running', null, 'Conditioning');

    const blocks = page.locator('.exercise-block');
    await expect(blocks).toHaveCount(2);
    await expect(blocks.nth(0).locator('h3')).toHaveText('Bench Press');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Running');

    const cardioBlock = page.locator('.cardio-exercise-block');
    await expect(cardioBlock.locator('.cardio-set-row')).toHaveCount(1);

    const plannedDuration = cardioBlock.getByLabel('Planned Duration');
    await plannedDuration.fill('30:30');
    await plannedDuration.press('Tab');
    await cardioBlock.getByLabel('Planned Distance').fill('5');
    await cardioBlock.getByLabel('Distance Unit').selectOption('km');
    await cardioBlock.getByLabel('Target RPE').fill('6');

    await expect(cardioBlock.getByLabel('Planned Duration')).toHaveValue('30:30');
    await expect(cardioBlock.getByLabel('Planned Distance')).toHaveValue('5');
    await expect(cardioBlock.getByLabel('Distance Unit')).toHaveValue('km');
    await expect(cardioBlock.getByLabel('Target RPE')).toHaveValue('6');

    await cardioBlock.getByRole('button', { name: '+ Set', exact: true }).click();
    await expect(cardioBlock.locator('.cardio-set-row')).toHaveCount(2);

    await page.getByRole('button', { name: 'Move Running up' }).click();
    await expect(blocks.nth(0).locator('h3')).toHaveText('Running');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Bench Press');

    await flushPersistence(page);
    await page.reload();
    await expect(page.getByTestId('app-ready')).toBeVisible();
    await expect(blocks.nth(0).locator('h3')).toHaveText('Running');
    await expect(page.locator('.cardio-exercise-block').getByLabel('Planned Duration').first()).toHaveValue('30:30');

    const summary = page.getByRole('region', { name: 'Workout strength training summary' });
    await expect(summary.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('1');
    await expect(summary.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('1');

    await navigateTo(page, `/programs/${programId}/exercises`);
    await page.locator('.ex-item', { hasText: 'Running' }).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('radio', { name: 'Cardio' })).toBeDisabled();
    await expect(page.getByText('Type cannot be changed after an exercise has been programmed.')).toBeVisible();
  });

  test('manual and generated workout copies preserve cardio data', async ({ page }) => {
    await addExerciseViaUI(page, 'Running', null, 'Conditioning');
    const cardioBlock = page.locator('.cardio-exercise-block');
    const plannedDuration = cardioBlock.getByLabel('Planned Duration');
    await plannedDuration.fill('25:15');
    await plannedDuration.press('Tab');
    await cardioBlock.getByLabel('Target RPE').fill('5');
    await flushPersistence(page);

    await page.getByRole('link', { name: 'Mesocycle' }).click();
    await copyWorkout(page, 'Mixed Day');
    await openWorkout(page, 'Mixed Day (Copy)');
    await expect(page.locator('.cardio-exercise-block').getByLabel('Planned Duration')).toHaveValue('25:15');
    await expect(page.locator('.cardio-exercise-block').getByLabel('Target RPE')).toHaveValue('5');

    await page.getByRole('link', { name: 'Mesocycle' }).click();
    await page.getByRole('button', { name: 'Generate Workouts' }).click();
    await page.locator('input[name="planning-algorithm"][value="simple-plan"]').check();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('.generator-checklist-item', { hasText: 'Mixed Day' }).first()
      .locator('input[type="checkbox"]').check();
    await page.fill('#gen-total-occurrences', '2');
    await page.getByRole('button', { name: 'Preview' }).click();
    await page.locator('.modal-footer').getByRole('button', { name: 'Generate' }).click();

    await page.locator('.day-cell').nth(7).locator('.workout-chip-link', { hasText: 'Mixed Day' }).click();
    await expect(page.locator('.cardio-exercise-block').getByLabel('Planned Duration')).toHaveValue('25:15');
    await expect(page.locator('.cardio-exercise-block').getByLabel('Target RPE')).toHaveValue('5');
  });

  test('program backup and restore preserve cardio sets', async ({ page }) => {
    await addExerciseViaUI(page, 'Running', null, 'Conditioning');
    const workoutUrl = page.url();
    const plannedDuration = page.locator('.cardio-exercise-block').getByLabel('Planned Duration');
    await plannedDuration.fill('20:45');
    await plannedDuration.press('Tab');
    await page.locator('.cardio-exercise-block').getByLabel('Actual RPE').fill('7');
    await flushPersistence(page);

    await navigateTo(page, `/programs/${programId}/data`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Program Backup' }).click(),
    ]);
    const backupPath = await download.path();
    const backup = fs.readFileSync(backupPath);

    await navigateTo(page, workoutUrl);
    const changedDuration = page.locator('.cardio-exercise-block').getByLabel('Planned Duration');
    await changedDuration.fill('40:00');
    await changedDuration.press('Tab');
    await flushPersistence(page);

    await navigateTo(page, `/programs/${programId}/data`);
    await page.locator('input[accept=".sqlite"]').setInputFiles({
      name: 'cardio-backup.sqlite',
      mimeType: 'application/octet-stream',
      buffer: backup,
    });
    await page.locator('.modal-content').getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.modal-content')).toBeHidden();
    await expect(page.locator('.alert-success, .alert-warning')).toContainText('restored');

    await navigateTo(page, workoutUrl);
    await expect(page.locator('.cardio-exercise-block')).toBeVisible();
    await expect(page.locator('.cardio-exercise-block').getByLabel('Planned Duration')).toHaveValue('20:45');
    await expect(page.locator('.cardio-exercise-block').getByLabel('Actual RPE')).toHaveValue('7');
  });
});
