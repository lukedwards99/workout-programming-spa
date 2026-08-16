import { expect, type Page } from '@playwright/test';

export async function flushPersistence(page: Page): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => typeof window.__liftlogE2E?.flushPersistence === 'function'),
  ).toBe(true);
  await page.evaluate(() => window.__liftlogE2E!.flushPersistence());
}

/**
 * Reset all app data by deleting every program from the home page.
 */
export async function deleteAllProgramsViaUI(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-ready')).toBeVisible();

  let attempts = 0;
  while (attempts < 20) {
    const deleteBtns = page.locator('button:has-text("Delete")');
    const count = await deleteBtns.count();
    if (count === 0) break;
    await deleteBtns.first().click();
    await expect(page.locator('.modal-content')).toBeVisible();
    await page.locator('.modal-content .btn-danger').click();
    await expect(deleteBtns).toHaveCount(count - 1);
    attempts++;
  }

  await page.goto('/');
  await expect(page.getByTestId('app-ready')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
}

export async function waitForApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-ready')).toBeVisible();
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await flushPersistence(page);
  await page.goto(path);
  await expect(page.getByTestId('app-ready')).toBeVisible();
}

export async function createProgramViaUI(page: Page, name: string, notes: string = ''): Promise<void> {
  const cards = page.locator('.card');
  await page.click('button:has-text("+ New Program")');
  await expect(page.locator('.modal-content')).toBeVisible();
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) {
    await page.locator('.modal-content textarea').fill(notes);
  }
  await page.locator('.modal-content button:has-text("Save")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(cards.filter({ hasText: name })).toBeVisible();
}

export async function viewProgram(page: Page, name: string): Promise<void> {
  const card = page.locator('.card', { hasText: name });
  await card.locator('a:has-text("View")').click();
  await page.waitForSelector('.breadcrumb', { timeout: 5000 });
}

export async function seedProgramViaUI(page: Page, name: string, notes: string = '', opts: { skipNav?: boolean } = {}): Promise<number | null> {
  await createProgramViaUI(page, name, notes);
  if (!opts.skipNav) {
    await viewProgram(page, name);
  }
  const url = page.url();
  const match = url.match(/\/programs\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function addMesocycleViaUI(page: Page, name: string, length: number = 7, startDate: string | null = null): Promise<void> {
  const rows = page.locator('tr.hoverable-row');
  const initialCount = await rows.count();
  await page.locator('input[placeholder*="4-Week"]').fill(name);
  await page.locator('input[type="number"]').fill(String(length));
  if (startDate) {
    await page.locator('input[type="date"]').fill(startDate);
  }
  await page.click('button:has-text("+ Add Mesocycle")');
  await expect(rows).toHaveCount(initialCount + 1);
  await expect(rows.filter({ hasText: name })).toBeVisible();
}

export async function viewMesocycle(page: Page, name: string): Promise<void> {
  const row = page.locator('tr', { hasText: name });
  await row.click();
  await expect(page.locator('.day-grid, .day-cell').first()).toBeVisible();
}

export async function addWorkoutViaUI(page: Page, dayIndex: number, name: string): Promise<void> {
  const cells = page.locator('.day-cell');
  const targetCell = cells.nth(dayIndex);
  await targetCell.locator('button:has-text("+ Add workout")').click();
  await expect(page.locator('.modal-content')).toBeVisible();
  await page.locator('.modal-content input').fill(name);
  await page.locator('.modal-content button:has-text("Add")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(targetCell.locator('.workout-chip', { hasText: name })).toBeVisible();
}

export async function openWorkout(page: Page, name: string): Promise<void> {
  await page.locator('.workout-chip', { hasText: name }).click();
  await page.waitForSelector('.exercise-block, .empty-state', { timeout: 5000 });
}

export async function addExerciseViaUI(
  page: Page,
  exerciseName: string,
  variationName: string | null = null,
  groupName: string | null = null,
): Promise<void> {
  const blocks = page.locator('.exercise-block');
  const initialCount = await blocks.count();
  await page.click('button:has-text("+ Add Exercise")');
  await expect(page.locator('.modal-content')).toBeVisible();
  const selects = page.locator('.modal-content select');
  const selectCount = await selects.count();
  if (selectCount >= 2) {
    if (groupName) await selects.first().selectOption({ label: groupName });
    else await selects.first().selectOption({ index: 1 });
    await selects.nth(1).selectOption({ label: exerciseName });
  } else {
    await selects.first().selectOption({ label: exerciseName });
  }
  if (variationName) {
    await page.locator('.modal-content select').last().selectOption({ label: variationName });
  }
  await page.locator('.modal-content button:has-text("Add")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(blocks).toHaveCount(initialCount + 1);
  await expect(blocks.last().locator('h3')).toContainText(exerciseName);
}

export async function addSetViaUI(page: Page, type: string = 'normal'): Promise<void> {
  const rows = page.locator('.exercise-block').last().locator('.set-table tbody tr');
  const initialCount = await rows.count();
  await page.locator('.exercise-block button:has-text("+ Set")').last().click();
  await expect(rows).toHaveCount(initialCount + 1);
  const select = page.locator('.exercise-block select').last();
  await select.selectOption(type);
  await expect(select).toHaveValue(type);
}

export async function fillSetRow(page: Page, exerciseIndex: number, setIndex: number, { plannedReps, actualReps, weight, rir }: { plannedReps?: number; actualReps?: number; weight?: number; rir?: number }): Promise<void> {
  const rows = page.locator('.exercise-block').nth(exerciseIndex).locator('.set-table tbody tr');
  const row = rows.nth(setIndex);
  if (plannedReps !== undefined) await row.locator('td[data-label="Planned Reps"] input').fill(String(plannedReps));
  if (actualReps !== undefined) await row.locator('td[data-label="Actual Reps"] input').fill(String(actualReps));
  if (weight !== undefined) await row.locator('td[data-label="Weight"] input').fill(String(weight));
  if (rir !== undefined) await row.locator('td[data-label="RIR"] input').fill(String(rir));
}

export async function addExerciseGroupViaUI(page: Page, name: string, notes: string = ''): Promise<void> {
  await page.locator('button:has-text("+ New Group")').click();
  await expect(page.locator('.modal-content')).toBeVisible();
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

export async function addExerciseToLibraryViaUI(
  page: Page,
  groupName: string,
  exerciseName: string,
  notes: string = '',
  tutorialUrl: string = '',
  exerciseType: 'strength' | 'cardio' = 'strength',
): Promise<void> {
  await page.click('button:has-text("+ Add Exercise")');
  await expect(page.locator('.modal-content')).toBeVisible();
  await page.locator('.modal-content select').selectOption(groupName);
  if (exerciseType === 'cardio') {
    await page.getByRole('radio', { name: 'Cardio' }).check();
  }
  await page.locator('.modal-content input[required]').fill(exerciseName);
  if (tutorialUrl) {
    await page.locator('.modal-content input[placeholder="https://..."]').fill(tutorialUrl);
  }
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(page.locator('.ex-item', { hasText: exerciseName })).toBeVisible();
}

export async function openWorkoutEdit(page: Page, workoutName: string): Promise<void> {
  const chip = page.locator('.workout-chip', { hasText: workoutName });
  await chip.locator('[aria-label^="Edit"]').click();
  await page.waitForSelector('.modal-content');
}

export async function editWorkout(page: Page, workoutName: string, newName: string, newDay?: string | number): Promise<void> {
  await openWorkoutEdit(page, workoutName);
  if (newName !== workoutName) {
    await page.locator('#edit-workout-name').fill(newName);
  }
  if (newDay !== undefined) {
    await page.locator('#edit-workout-day').selectOption(String(newDay));
  }
  await page.locator('.modal-content button:has-text("Save Changes")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(page.locator('.workout-chip', { hasText: newName })).toBeVisible();
}

export async function copyWorkout(page: Page, workoutName: string, targetDay?: string | number): Promise<void> {
  await openWorkoutEdit(page, workoutName);
  if (targetDay !== undefined) {
    await page.locator('#edit-workout-day').selectOption(String(targetDay));
  }
  await page.locator('.modal-content button:has-text("Copy Workout")').click();
  await expect(page.locator('.modal-content')).toBeHidden();
  await expect(page.locator('.workout-chip', { hasText: `${workoutName} (Copy)` })).toBeVisible();
}
