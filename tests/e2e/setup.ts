import type { Page } from '@playwright/test';

/**
 * Reset all app data by deleting every program from the home page.
 */
export async function clearDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);

  let attempts = 0;
  while (attempts < 20) {
    const deleteBtns = page.locator('button:has-text("Delete")');
    const count = await deleteBtns.count();
    if (count === 0) break;
    await deleteBtns.first().click();
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content .btn-danger').click();
    await page.waitForTimeout(500);
    attempts++;
  }

  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 10000 });
  await page.waitForTimeout(500);
}

export async function waitForApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForSelector('.nav-bar', { timeout: 10000 });
  await page.waitForTimeout(300);
}

export async function createProgramViaUI(page: Page, name: string, notes: string = ''): Promise<void> {
  await page.click('button:has-text("+ New Program")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) {
    await page.locator('.modal-content textarea').fill(notes);
  }
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForSelector('.card, .empty-state', { timeout: 5000 });
  await page.waitForTimeout(300);
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
    await page.waitForTimeout(500);
  }
  const url = page.url();
  const match = url.match(/\/programs\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function addMesocycleViaUI(page: Page, name: string, length: number = 7, startDate: string | null = null): Promise<void> {
  await page.locator('input[placeholder*="4-Week"]').fill(name);
  await page.locator('input[type="number"]').fill(String(length));
  if (startDate) {
    await page.locator('input[type="date"]').fill(startDate);
  }
  await page.click('button:has-text("+ Add Mesocycle")');
  await page.waitForTimeout(500);
}

export async function viewMesocycle(page: Page, name: string): Promise<void> {
  const row = page.locator('tr', { hasText: name });
  await row.click();
  await page.waitForSelector('.day-grid, .day-cell', { timeout: 5000 });
  await page.waitForTimeout(300);
}

export async function addWorkoutViaUI(page: Page, dayIndex: number, name: string): Promise<void> {
  const cells = page.locator('.day-cell');
  await cells.nth(dayIndex).locator('button:has-text("+ Add workout")').click();
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input').fill(name);
  await page.locator('.modal-content button:has-text("Add")').click();
  await page.waitForTimeout(500);
}

export async function openWorkout(page: Page, name: string): Promise<void> {
  await page.locator('.workout-chip', { hasText: name }).click();
  await page.waitForSelector('.exercise-block, .empty-state', { timeout: 5000 });
}

export async function addExerciseViaUI(page: Page, exerciseName: string, variationName: string | null = null): Promise<void> {
  await page.click('button:has-text("+ Add Exercise")');
  await page.waitForSelector('.modal-content');
  const selects = page.locator('.modal-content select');
  const selectCount = await selects.count();
  if (selectCount >= 2) {
    await selects.first().selectOption({ index: 1 });
    await page.waitForTimeout(300);
    await selects.nth(1).selectOption({ label: exerciseName });
  } else {
    await selects.first().selectOption({ label: exerciseName });
  }
  if (variationName) {
    await page.locator('.modal-content select').last().selectOption({ label: variationName });
  }
  await page.locator('.modal-content button:has-text("Add")').click();
  await page.waitForTimeout(500);
}

export async function addSetViaUI(page: Page, type: string = 'normal'): Promise<void> {
  await page.locator('.exercise-block button:has-text("+ Set")').last().click();
  await page.waitForTimeout(300);
  const select = page.locator('.exercise-block select').last();
  await select.selectOption(type);
  await page.waitForTimeout(300);
}

export async function fillSetRow(page: Page, exerciseIndex: number, setIndex: number, { reps, weight, rir }: { reps?: number; weight?: number; rir?: number }): Promise<void> {
  const rows = page.locator('.exercise-block').nth(exerciseIndex).locator('.set-table tbody tr');
  const row = rows.nth(setIndex);
  if (reps !== undefined) await row.locator('input').nth(0).fill(String(reps));
  if (weight !== undefined) await row.locator('input').nth(1).fill(String(weight));
  if (rir !== undefined) await row.locator('input').nth(2).fill(String(rir));
  await page.waitForTimeout(300);
}

export async function addExerciseGroupViaUI(page: Page, name: string, notes: string = ''): Promise<void> {
  await page.locator('button:has-text("+ New Group")').click();
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(400);
}

export async function addExerciseToLibraryViaUI(page: Page, groupName: string, exerciseName: string, notes: string = '', tutorialUrl: string = ''): Promise<void> {
  await page.click('button:has-text("+ Add Exercise")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content select').selectOption(groupName);
  await page.locator('.modal-content input[required]').fill(exerciseName);
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(400);
}
