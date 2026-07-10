/**
 * Reset all app data via the "Delete All Data" UI button.
 */
export async function clearDatabase(page) {
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);

  // Create a temp program if none exist, then use its data page to delete all
  const cards = page.locator('.card');
  const cardCount = await cards.count();

  if (cardCount > 0) {
    // Navigate to first program's data tab
    await cards.first().locator('a:has-text("View")').click();
    await page.waitForSelector('.breadcrumb', { timeout: 5000 });
  } else {
    // Create a temp program
    await page.click('button:has-text("+ New Program")');
    await page.waitForSelector('.modal-content');
    await page.locator('.modal-content input[required]').fill('__temp__');
    await page.locator('.modal-content button:has-text("Save")').click();
    await page.waitForTimeout(500);
    const card = page.locator('.card').first();
    await card.locator('a:has-text("View")').click();
    await page.waitForSelector('.breadcrumb', { timeout: 5000 });
  }

  // Go to Data tab
  await page.locator('.program-tabs a:has-text("Data")').click();
  await page.waitForSelector('button:has-text("Delete All Data")', { timeout: 5000 });
  await page.waitForTimeout(300);

  // Click Delete All Data
  await page.click('button:has-text("Delete All Data")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content .btn-danger').click();
  await page.waitForTimeout(800);

  // Go home
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 10000 });
  await page.waitForTimeout(500);
}

export async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);
}

export async function navigateTo(page, path) {
  await page.goto(path);
  await page.waitForSelector('.nav-bar', { timeout: 10000 });
  await page.waitForTimeout(300);
}

export async function createProgramViaUI(page, name, notes = '') {
  await page.click('button:has-text("+ New Program")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) {
    await page.locator('.modal-content textarea').fill(notes);
  }
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(500);
}

export async function viewProgram(page, name) {
  const card = page.locator('.card', { hasText: name });
  await card.locator('a:has-text("View")').click();
  await page.waitForSelector('.breadcrumb', { timeout: 5000 });
}

export async function seedProgramViaUI(page, name, notes = '', opts = {}) {
  await createProgramViaUI(page, name, notes);
  if (!opts.skipNav) {
    await viewProgram(page, name);
    await page.waitForTimeout(500);
  }
  const url = page.url();
  const match = url.match(/\/programs\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function addMesocycleViaUI(page, name, length = 7, startDate = null) {
  await page.locator('input[placeholder*="4-Week"]').fill(name);
  await page.locator('input[type="number"]').fill(String(length));
  if (startDate) {
    await page.locator('input[type="date"]').fill(startDate);
  }
  await page.click('button:has-text("+ Add Mesocycle")');
  await page.waitForTimeout(500);
}

export async function viewMesocycle(page, name) {
  const row = page.locator('tr', { hasText: name });
  await row.locator('a:has-text("View")').click();
  await page.waitForSelector('.day-grid', { timeout: 5000 });
}

export async function addWorkoutViaUI(page, dayIndex, name) {
  const cells = page.locator('.day-cell');
  await cells.nth(dayIndex).locator('button:has-text("+ Add workout")').click();
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input').fill(name);
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(500);
}

export async function openWorkout(page, name) {
  await page.locator('.workout-chip', { hasText: name }).click();
  await page.waitForSelector('.exercise-block, .empty-state', { timeout: 5000 });
}

export async function addExerciseViaUI(page, exerciseName, variationName = null) {
  await page.click('button:has-text("+ Add Exercise")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content select').first().selectOption({ label: exerciseName });
  if (variationName) {
    await page.locator('.modal-content select').last().selectOption({ label: variationName });
  }
  await page.locator('.modal-content button:has-text("Add")').click();
  await page.waitForTimeout(500);
}

export async function addSetViaUI(page, type = 'normal') {
  const select = page.locator('.exercise-block select').last();
  await select.selectOption(type);
  await page.waitForTimeout(300);
}

export async function fillSetRow(page, exerciseIndex, setIndex, { reps, weight, rir }) {
  const rows = page.locator('.exercise-block').nth(exerciseIndex).locator('.set-table tbody tr');
  const row = rows.nth(setIndex);
  if (reps !== undefined) await row.locator('input').nth(0).fill(String(reps));
  if (weight !== undefined) await row.locator('input').nth(1).fill(String(weight));
  if (rir !== undefined) await row.locator('input').nth(2).fill(String(rir));
  await page.waitForTimeout(300);
}

export async function addExerciseGroupViaUI(page, name, notes = '') {
  await page.locator('.lib-sidebar button:has-text("+ New Group")').click();
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content input[required]').fill(name);
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(400);
}

export async function addExerciseToLibraryViaUI(page, groupName, exerciseName, notes = '', tutorialUrl = '') {
  await page.click('button:has-text("+ Add Exercise")');
  await page.waitForSelector('.modal-content');
  await page.locator('.modal-content select').selectOption(groupName);
  await page.locator('.modal-content input[required]').fill(exerciseName);
  if (notes) await page.locator('.modal-content textarea').fill(notes);
  await page.locator('.modal-content button:has-text("Save")').click();
  await page.waitForTimeout(400);
}
