import { test, expect } from '@playwright/test';
import {
  clearDatabase, createProgramViaUI, viewProgram,
  addMesocycleViaUI, viewMesocycle,
  addWorkoutViaUI, openWorkout,
  addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addExerciseViaUI, addSetViaUI, fillSetRow,
} from './setup';

test.describe('Workout Generator', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await createProgramViaUI(page, 'Gen Test');
    await viewProgram(page, 'Gen Test');
    await page.waitForTimeout(500);
  });

  test('GEN-1: Mesocycle page exposes Generate Workouts button and picker contains Simple plan', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 14);
    await viewMesocycle(page, 'Block');

    const btn = page.locator('button:has-text("Generate Workouts")');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForSelector('.modal-content');

    await expect(page.locator('.modal-content')).toContainText('Choose Planning Type');
    await expect(page.locator('.modal-content')).toContainText('Simple plan');
    await expect(page.locator('.modal-content')).toContainText('Repeat one or more completed sample workouts');
  });

  test('GEN-2: Empty mesocycle shows message that sample workouts must be created', async ({ page }) => {
    await addMesocycleViaUI(page, 'Empty Block', 7);
    await viewMesocycle(page, 'Empty Block');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');

    // Select Simple plan, click Next
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    // Should show empty state message
    await expect(page.locator('.empty-state')).toContainText('No sample workouts exist');
  });

  test('GEN-3: One sample on day 1, interval 7, 3 occurrences creates copies on days 8 and 15', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 21);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Push A');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');

    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    // Select the workout
    await page.click('.generator-checklist-item input[type="checkbox"]');
    // Set repeat = 7, occurrences = 3
    await page.fill('#gen-repeat-days', '7');
    await page.fill('#gen-total-occurrences', '3');

    await page.click('button:has-text("Preview")');

    // Check preview shows copies on days 8 and 15
    await expect(page.locator('.generator-preview-table')).toContainText('Push A');
    await expect(page.locator('.generator-preview-table')).toContainText('8');  // Day 8 (day_offset 7)
    await expect(page.locator('.generator-preview-table')).toContainText('15'); // Day 15 (day_offset 14)
    await expect(page.locator('.generator-preview-summary')).toContainText('will be added');

    // Generate
    await page.locator('.modal-footer button:has-text("Generate")').click();
    await page.waitForTimeout(500);

    // Verify copies appear in the grid
    await expect(page.locator('.day-cell').nth(7)).toContainText('Push A');
    await expect(page.locator('.day-cell').nth(14)).toContainText('Push A');
  });

  test('GEN-4: Two samples with different offsets preserve their spacing', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 28);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Push');
    await addWorkoutViaUI(page, 2, 'Pull');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    // Select both workouts
    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.locator('.generator-checklist-item input[type="checkbox"]').nth(1).check();
    await page.fill('#gen-total-occurrences', '3');

    await page.click('button:has-text("Preview")');

    // Verify occurrence 2 has Push on day 8 and Pull on day 10
    // Day 0 (occurrence 1 = source): Push, day_offset=0; Pull, day_offset=2
    // RepeatEvery=7, so occurrence 2: Push on 0+7=7 (day 8), Pull on 2+7=9 (day 10)
    await expect(page.locator('.generator-preview-table')).toContainText('Push');
    await expect(page.locator('.generator-preview-table')).toContainText('Pull');
  });

  test('GEN-5: Multiple samples on same day all copy', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 21);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Workout A');
    await addWorkoutViaUI(page, 0, 'Workout B');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.locator('.generator-checklist-item input[type="checkbox"]').nth(1).check();
    await page.fill('#gen-total-occurrences', '3');

    await page.click('button:has-text("Preview")');
    await page.locator('.modal-footer button:has-text("Generate")').click();
    await page.waitForTimeout(500);

    // Both should appear on day 7 (8th cell)
    await expect(page.locator('.day-cell').nth(7)).toContainText('Workout A');
    await expect(page.locator('.day-cell').nth(7)).toContainText('Workout B');
  });

  test('GEN-6: Deep copy preserves exercise and set data', async ({ page }) => {
    // Navigate to exercises and create exercise library
    await page.locator('.program-tabs a:has-text("Exercises")').click();
    await page.waitForTimeout(500);
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

    // Go back to mesocycles, create a meso and workout with exercise data
    await page.locator('.program-tabs a:has-text("Mesocycles")').click();
    await page.waitForTimeout(500);
    await addMesocycleViaUI(page, 'Block', 14);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Deep Test');

    // Add exercise with sets
    await openWorkout(page, 'Deep Test');
    await addExerciseViaUI(page, 'Bench Press');
    await addSetViaUI(page, 'normal');
    await addSetViaUI(page, 'dropset');
    await fillSetRow(page, 0, 0, { plannedReps: 10, weight: 135, rir: 2 });
    await fillSetRow(page, 0, 1, { plannedReps: 8, weight: 95 });
    await page.waitForTimeout(500);

    // Navigate back to mesocycle page
    const url = page.url();
    const match = url.match(/\/programs\/(\d+)\/workouts\/(\d+)/);
    const programId = match?.[1];
    await page.goto(`/programs/${programId}/mesocycles/1`);
    await page.waitForSelector('.day-cell', { timeout: 10000 });

    // Generate a copy on day 7
    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');
    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.fill('#gen-total-occurrences', '2');
    await page.click('button:has-text("Preview")');
    await page.locator('.modal-footer button:has-text("Generate")').click();
    await page.waitForTimeout(500);

    // Navigate to the copy and verify sets
    await page.locator('.day-cell').nth(7).locator('.workout-chip-link').first().click();
    await page.waitForSelector('.exercise-block', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Should have Bench Press and 2 sets
    await expect(page.locator('.exercise-block')).toContainText('Bench Press');
    const firstRow = page.locator('.exercise-block').first().locator('.set-table tbody tr').first();
    await expect(firstRow.locator('input').nth(0)).toHaveValue('10');
  });

  test('GEN-7: Destination day with existing workout preserves both', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 14);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Source');
    await addWorkoutViaUI(page, 7, 'Existing');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.fill('#gen-total-occurrences', '2');
    await page.click('button:has-text("Preview")');
    await page.locator('.modal-footer button:has-text("Generate")').click();
    await page.waitForTimeout(500);

    // Day 8 (index 7) should have both workouts
    const day7Cell = page.locator('.day-cell').nth(7);
    await expect(day7Cell).toContainText('Existing');
    await expect(day7Cell).toContainText('Source');
  });

  test('GEN-8: Copies beyond mesocycle are omitted', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 10);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Short Source');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.fill('#gen-repeat-days', '7');
    await page.fill('#gen-total-occurrences', '3');

    await page.click('button:has-text("Preview")');

    // Occurrence 3 (day_offset 14) should be omitted (meso length 10)
    await expect(page.locator('.generator-preview-summary')).toContainText('will be skipped');
    await expect(page.locator('.generator-omitted')).toContainText('Short Source');
    await expect(page.locator('.generator-omitted')).toContainText('15'); // day 15 = day_offset 14
  });

  test('GEN-9: Cancel makes no database changes', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 14);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Cancel Test');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.fill('#gen-total-occurrences', '2');
    await page.click('button:has-text("Preview")');

    // Cancel
    await page.locator('.modal-content button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Day 7 should not have Cancel Test
    const day7 = page.locator('.day-cell').nth(7);
    await expect(day7.locator('.workout-chip')).toHaveCount(0);
  });

  test('GEN-10: Invalid interval and occurrences block submission with clear errors', async ({ page }) => {
    await addMesocycleViaUI(page, 'Block', 14);
    await viewMesocycle(page, 'Block');
    await addWorkoutViaUI(page, 0, 'Err Test');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.fill('#gen-repeat-days', '0');
    await page.fill('#gen-total-occurrences', '1');

    // Error messages should be visible during the configure stage
    await expect(page.locator('.alert-danger')).toContainText('Repeat every X days must be a positive integer');
    await expect(page.locator('.alert-danger')).toContainText('Total occurrences must be an integer of at least 2');

    // Preview button should be disabled (invalid inputs)
    await expect(page.locator('button:has-text("Preview")')).toBeDisabled();

    // Fix repeat, still invalid occurrences
    await page.fill('#gen-repeat-days', '7');
    await expect(page.locator('button:has-text("Preview")')).toBeDisabled();

    // Fix occurrences
    await page.fill('#gen-total-occurrences', '2');
    await expect(page.locator('button:has-text("Preview")')).toBeEnabled();
  });

  test('GEN-11: Fresh v4 database uses mesocycle_length', async ({ page }) => {
    await addMesocycleViaUI(page, 'V4 Test', 10);
    await viewMesocycle(page, 'V4 Test');

    // Should show "10-day mesocycle" in header
    await expect(page.locator('p')).toContainText('10-day mesocycle');

    // Should have 10 day cells
    const cells = page.locator('.day-cell');
    await expect(cells).toHaveCount(10);
  });

  test('GEN-12: Existing copy, edit, delete still work on v4 schema', async ({ page }) => {
    await addMesocycleViaUI(page, 'V4 Block', 14);
    await viewMesocycle(page, 'V4 Block');
    await addWorkoutViaUI(page, 0, 'Op Test');

    // Copy via edit modal
    const editBtn = page.locator('.day-cell').first().locator('[aria-label^="Edit"]');
    await editBtn.click();
    await page.waitForSelector('.modal-content');

    // Change day and copy
    await page.locator('#edit-workout-day').selectOption('2');
    await page.click('button:has-text("Copy Workout")');
    await page.waitForTimeout(500);

    // Should have "(Copy)" on day 3 and original on day 1
    await expect(page.locator('.day-cell').nth(0)).toContainText('Op Test');
    await expect(page.locator('.day-cell').nth(2)).toContainText('(Copy)');

    // Delete original
    const editBtn2 = page.locator('.day-cell').first().locator('[aria-label^="Edit"]');
    await editBtn2.click();
    await page.waitForSelector('.modal-content');
    await page.click('button:has-text("Delete")');
    await page.waitForSelector('.modal-content');
    await page.click('.modal-content .btn-danger');
    await page.waitForTimeout(500);

    // Original gone, copy remains
    await expect(page.locator('.day-cell').nth(0)).not.toContainText('Op Test');
    await expect(page.locator('.day-cell').nth(2)).toContainText('(Copy)');
  });

  test('GEN-13: Generator is usable at phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await addMesocycleViaUI(page, 'Mobile Block', 14);
    await viewMesocycle(page, 'Mobile Block');
    await addWorkoutViaUI(page, 0, 'Mobile W');

    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');

    // Should not have horizontal overflow
    const modalBody = page.locator('.modal-body');
    const bodyBox = await modalBody.boundingBox();
    expect(bodyBox).not.toBeNull();

    // Navigate through all stages
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');
    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();
    await page.click('button:has-text("Preview")');

    // Confirm and Cancel buttons should be visible
    await expect(page.locator('.modal-footer button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('.modal-footer button:has-text("Generate")')).toBeVisible();
  });

  test('GEN-14: P1 — zero repeat interval does not freeze when navigating back and forward', async ({ page }) => {
    await addMesocycleViaUI(page, 'Freeze Block', 14);
    await viewMesocycle(page, 'Freeze Block');
    await addWorkoutViaUI(page, 0, 'Freeze Test');

    // Open generator and select the workout
    await page.click('button:has-text("Generate Workouts")');
    await page.waitForSelector('.modal-content');
    await page.click('input[name="planning-algorithm"][value="simple-plan"]');
    await page.click('button:has-text("Next")');

    await page.locator('.generator-checklist-item input[type="checkbox"]').first().check();

    // Enter 0 for repeat — the critical P1 trigger
    await page.fill('#gen-repeat-days', '0');
    // Reset occurrences to something valid to avoid a different validation block
    await page.fill('#gen-total-occurrences', '4');

    // Navigate back to planning-type stage
    await page.locator('.modal-footer button:has-text("Back")').click();
    await page.waitForSelector('input[value="simple-plan"]', { timeout: 5000 });

    // Proceed forward again — must NOT freeze the browser
    await page.click('button:has-text("Next")');
    await page.waitForSelector('.generator-form', { timeout: 5000 });

    // Should be back on configure stage with error shown for the 0 interval
    await expect(page.locator('.alert-danger')).toContainText('Repeat every X days must be a positive integer');
    await expect(page.locator('button:has-text("Preview")')).toBeDisabled();
  });
});
