import { test, expect } from '@playwright/test';
import {
  clearDatabase, navigateTo, seedProgramViaUI,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addMesocycleViaUI, viewMesocycle, addWorkoutViaUI, openWorkout,
  addExerciseViaUI, addSetViaUI, fillSetRow,
} from './setup';

test.describe('Summary Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.waitForTimeout(500);

    const programId = await seedProgramViaUI(page, 'Summary Stats Program');

    await navigateTo(page, `/programs/${programId}/exercises`);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Incline Press');

    await navigateTo(page, `/programs/${programId}`);
    await addMesocycleViaUI(page, 'Block 1', 7);
    await viewMesocycle(page, 'Block 1');
    await addWorkoutViaUI(page, 0, 'Full Body');
    await openWorkout(page, 'Full Body');
  });

  test('workout summary displays all programmed stats', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await addSetViaUI(page, 'warmup');
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 45 });
    await fillSetRow(page, 0, 1, { plannedReps: 10, weight: 135 });

    await addExerciseViaUI(page, 'Incline Press');
    await fillSetRow(page, 1, 0, { plannedReps: 12, weight: 0 });
    await page.locator('.exercise-block').nth(1).locator('td[data-label="Weight"] input').clear();
    await page.waitForTimeout(300);

    await expect(page.locator('.stats-grid')).toBeVisible();

    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('2');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('3');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Warm-up Sets' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('32');
    // Selected set types include warm-ups. Three sets have planned reps: Bench normal (10),
    // Bench warm-up (10), and Incline normal (12), so avg = 32/3 = 10.7.
    await expect(page.locator('.stat-card').filter({ hasText: 'Avg Reps' }).locator('.val')).toHaveText('10.7');
    await expect(page.locator('.stat-card').filter({ hasText: 'Avg RIR' }).locator('.val')).toHaveText('\u2014');
  });

  test('warmup sets are excluded from working set counts', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('1');

    await addSetViaUI(page, 'warmup');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('2');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Warm-up Sets' }).locator('.val')).toHaveText('1');

    await addSetViaUI(page, 'dropset');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('2');
  });

  test('dropset and failure sets count as working sets', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await addSetViaUI(page, 'dropset');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('2');

    await addSetViaUI(page, 'failure');
    await page.waitForTimeout(400);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('3');
  });

  test('program summary shows data from workout sets', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 100 });

    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    await navigateTo(page, `/programs/${programId}/summary`);
    await page.waitForTimeout(500);

    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.stat-card').filter({ hasText: 'Mesocycles' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Workouts' }).locator('.val')).toHaveText('1');

    await expect(page.locator('.data-card h2').filter({ hasText: 'By Exercise Group' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By Exercise', exact: true })).toBeVisible();
    await expect(page.locator('table').first().locator('tbody')).toContainText('Chest');
  });

  test('program summary shows empty breakdowns when no sets', async ({ page }) => {
    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    // Don't add any exercises to the workout, just go to summary
    await navigateTo(page, `/programs/${programId}/summary`);
    await page.waitForTimeout(500);

    await expect(page.locator('.stats-grid')).toBeVisible();
    // Workout exists but has no sets
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('0');
    await expect(page.locator('.empty-state')).toContainText('No programmed training data');
  });

  test('mesocycle summary displays stats and breakdowns', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 100 });
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 1, { plannedReps: 8, weight: 120 });
    await page.waitForTimeout(300);

    // Get mesocycle link from breadcrumb
    const mesoLink = page.locator('.breadcrumb a').nth(1);
    const mesoHref = await mesoLink.getAttribute('href') || '';
    await navigateTo(page, mesoHref + '?view=summary');
    await page.waitForTimeout(500);

    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Workouts' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('2');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('18');

    await expect(page.locator('.data-card h2').filter({ hasText: 'By Exercise Group' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By Exercise', exact: true })).toBeVisible();
    await expect(page.locator('table').first().locator('th', { hasText: 'Actual Reps' })).toHaveCount(1);
    await expect(page.locator('table').nth(1).locator('th', { hasText: 'Actual Volume' })).toHaveCount(1);
  });

  test('mesocycle Schedule and Summary tabs are navigable', async ({ page }) => {
    // Navigate back to mesocycle page from workout page via breadcrumb
    const mesoLink = page.locator('.breadcrumb a').nth(1);
    const mesoHref = await mesoLink.getAttribute('href') || '';
    await navigateTo(page, mesoHref);
    await page.waitForTimeout(500);

    // Should start on Schedule view with day cells
    await expect(page.locator('.day-cell').first()).toBeVisible();

    // Navigate to Summary
    await page.locator('.program-tabs button').filter({ hasText: 'Summary' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.stats-grid')).toBeVisible();

    // Navigate back to Schedule
    await page.locator('.program-tabs button').filter({ hasText: 'Schedule' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.day-cell').first()).toBeVisible();
    await expect(page.url()).toContain('view=schedule');
  });

  test('workout summary updates after editing set data', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 100 });
    await page.waitForTimeout(300);

    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('10');

    await page.locator('.exercise-block').first().locator('td[data-label="Planned Reps"] input').fill('15');
    await page.waitForTimeout(500);

    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('15');
  });

  test('actual reps do not change programmed summary statistics', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, actualReps: 7, weight: 100 });
    await page.waitForTimeout(300);

    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('10');

    await page.locator('.exercise-block').first().locator('td[data-label="Actual Reps"] input').fill('12');
    await page.waitForTimeout(500);

    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('10');
  });

  test('null planned reps/weight are handled without NaN', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await page.locator('.exercise-block').first().locator('td[data-label="Planned Reps"] input').clear();
    await page.waitForTimeout(500);

    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('0');
    await expect(page.locator('.stat-card').filter({ hasText: 'Avg Reps' }).locator('.val')).toHaveText('\u2014');
  });

  test('program summary breakdown shows exercise group percentages', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 100 });
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 1, { plannedReps: 8, weight: 120 });

    await addExerciseViaUI(page, 'Incline Press');
    await fillSetRow(page, 1, 0, { plannedReps: 12 });
    await page.locator('.exercise-block').nth(1).locator('td[data-label="Weight"] input').clear();
    await page.waitForTimeout(300);

    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    await navigateTo(page, `/programs/${programId}/summary`);
    await page.waitForTimeout(500);

    // Both Bench Press and Incline are in Chest group, so Chest has 3 working sets = 100%
    const groupsTable = page.locator('table').first();
    await expect(groupsTable.locator('tbody')).toContainText('Chest');
    const chestRow = groupsTable.locator('tbody tr').filter({ hasText: 'Chest' });
    await expect(chestRow.locator('td[data-label="Working Sets"]')).toHaveText('3');
    await expect(chestRow.locator('td[data-label="% of Sets"]')).toHaveText('100%');
  });

  test('summary breakdowns show actual metrics and persist independent column choices', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, actualReps: 8, weight: 100 });
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 1, { plannedReps: 8, actualReps: 6, weight: 120 });
    await addSetViaUI(page, 'warmup');
    await fillSetRow(page, 0, 2, { plannedReps: 12, actualReps: 12, weight: 45 });

    await addExerciseViaUI(page, 'Incline Press');
    await fillSetRow(page, 1, 0, { plannedReps: 12, actualReps: 10 });

    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    await navigateTo(page, `/programs/${programId}/summary`);

    const groupsTable = page.locator('table').first();
    const chestGroup = groupsTable.locator('tbody tr').filter({ hasText: 'Chest' });
    await expect(chestGroup.locator('td[data-label="Actual Reps"]')).toHaveText('36');
    await expect(chestGroup.locator('td[data-label="Actual Volume"]')).toHaveText('2060');

    const exercisesTable = page.locator('table').nth(1);
    const benchRow = exercisesTable.locator('tbody tr').filter({ hasText: 'Bench Press' });
    await expect(benchRow.locator('td[data-label="Actual Reps"]')).toHaveText('26');
    await expect(benchRow.locator('td[data-label="Actual Volume"]')).toHaveText('2060');

    const groupControls = page.getByTestId('exercise-group-columns');
    await groupControls.locator('summary').click();
    await groupControls.getByLabel('Actual Volume').uncheck();
    await expect(groupsTable.locator('th', { hasText: 'Actual Volume' })).toHaveCount(0);

    const exerciseControls = page.getByTestId('exercise-columns');
    await exerciseControls.locator('summary').click();
    await exerciseControls.getByLabel('Group').uncheck();
    await expect(exercisesTable.locator('th').filter({ hasText: /^Group$/ })).toHaveCount(0);
    await expect(groupsTable.locator('th', { hasText: 'Actual Reps' })).toHaveCount(1);

    await page.reload();
    await expect(page.locator('table').first().locator('th', { hasText: 'Actual Volume' })).toHaveCount(0);
    await expect(page.locator('table').nth(1).locator('th').filter({ hasText: /^Group$/ })).toHaveCount(0);

    await page.evaluate(() => {
      localStorage.removeItem('summary-breakdown-columns:exercise-group');
      localStorage.removeItem('summary-breakdown-columns:exercise');
    });
  });

  test('exercises used only for warm-up sets are still counted', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await addSetViaUI(page, 'warmup');
    await page.waitForTimeout(300);

    // Change the existing normal set to warmup so ALL sets are warmup
    const typeSelect = page.locator('.exercise-block').first().locator('tbody tr').nth(0).locator('select.set-type-select');
    await typeSelect.selectOption('warmup');
    await page.waitForTimeout(400);

    await expect(page.locator('.stats-grid')).toBeVisible();
    // Exercise should still be counted even though all sets are warmup
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('0');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Warm-up Sets' }).locator('.val')).toHaveText('2');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('2');

    // Navigate to program summary — exercise should still be counted
    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    await navigateTo(page, `/programs/${programId}/summary`);
    await page.waitForTimeout(500);
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Exercises' }).locator('.val')).toHaveText('1');
  });

  test('invalid mesocycle view query defaults to schedule', async ({ page }) => {
    const mesoLink = page.locator('.breadcrumb a').nth(1);
    const mesoHref = await mesoLink.getAttribute('href') || '';

    // Navigate with invalid view value
    await navigateTo(page, mesoHref + '?view=foo');
    await page.waitForTimeout(500);

    // Should render Schedule view (day cells visible)
    await expect(page.locator('.day-cell').first()).toBeVisible();

    // Generate Workouts button should be visible (only on schedule)
    await expect(page.locator('button:has-text("Generate Workouts")')).toBeVisible();

    // Schedule tab should appear active (button text "Schedule")
    const scheduleBtn = page.locator('.program-tabs button.active');
    await expect(scheduleBtn).toHaveText('Schedule');

    // Navigate to Summary tab should work
    await page.locator('.program-tabs button').filter({ hasText: 'Summary' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.stats-grid')).toBeVisible();
    await expect(page.url()).toContain('view=summary');
  });

  test('set-type filters recalculate summaries and expandable rows show each selected type', async ({ page }) => {
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 10, actualReps: 8, weight: 100, rir: 2 });
    await addSetViaUI(page, 'warmup');
    await fillSetRow(page, 0, 1, { plannedReps: 6, actualReps: 6, weight: 45, rir: 3 });

    const filter = page.getByTestId('summary-set-type-filter');
    for (const label of ['Warm-up', 'Normal', 'Dropset', 'Failure', 'Rest-pause']) {
      await expect(filter.getByLabel(label)).toBeChecked();
    }

    await filter.getByLabel('Normal').uncheck();
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Sets' }).locator('.val')).toHaveText('1');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Working Sets' }).locator('.val')).toHaveText('0');
    await expect(page.locator('.stat-card').filter({ hasText: 'Programmed Reps' }).locator('.val')).toHaveText('6');

    const programId = page.url().match(/\/programs\/(\d+)/)?.[1];
    await navigateTo(page, `/programs/${programId}/summary`);
    // Direct navigation reloads the SPA, so the in-memory selection returns to its all-selected default.
    const programFilter = page.getByTestId('summary-set-type-filter');
    await expect(programFilter.getByLabel('Normal')).toBeChecked();
    await programFilter.getByLabel('Normal').uncheck();
    await page.getByRole('button', { name: 'Show details: Chest' }).click();

    const detail = page.getByRole('table', { name: 'Set type breakdown' }).first();
    await expect(detail.locator('tbody tr')).toHaveCount(4);
    await expect(detail.locator('tbody')).toContainText('Warm-up');
    await expect(detail.locator('tbody')).toContainText('6');
    await expect(detail.locator('tbody')).not.toContainText('Normal');
  });
});
