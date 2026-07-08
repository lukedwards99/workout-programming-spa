/**
 * Reset all app data by using the app's own "Delete All Data" UI
 * (avoids IndexedDB access issues with COEP headers).
 */
export async function clearDatabase(page) {
  // Navigate to data page and use Delete All Data button
  await page.goto('/data');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(800);

  const deleteBtn = page.locator('button:has-text("Delete All Data")');
  if (await deleteBtn.isVisible()) {
    page.once('dialog', (dialog) => dialog.accept());
    await deleteBtn.click();
    await page.waitForTimeout(800);
  }

  // Navigate home and wait for app to settle
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);
}

/**
 * Wait for the app with sql.js to fully initialize.
 */
export async function waitForApp(page) {
  await page.goto('/');
  await page.waitForSelector('.nav-bar', { timeout: 15000 });
  await page.waitForTimeout(500);
}

/**
 * Navigate to a path and wait for the page to load.
 */
export async function navigateTo(page, path) {
  await page.goto(path);
  await page.waitForSelector('.nav-bar', { timeout: 10000 });
  await page.waitForTimeout(300);
}

/**
 * Fill and submit the "New Program" modal.
 */
export async function createProgramViaUI(page, name, notes = '') {
  await page.click('button:has-text("+ New Program")');
  await page.waitForSelector('.modal-box');
  await page.locator('.modal-box input[required]').fill(name);
  if (notes) {
    await page.locator('.modal-box textarea').fill(notes);
  }
  await page.locator('.modal-box button:has-text("Save")').click();
  await page.waitForTimeout(500);
}

/**
 * Click "View" on the program card and wait for the program page.
 */
export async function viewProgram(page, name) {
  const card = page.locator('.card', { hasText: name });
  await card.locator('a:has-text("View")').click();
  await page.waitForSelector('.breadcrumb', { timeout: 5000 });
}

/**
 * Add a mesocycle via the inline form on ProgramPage.
 */
export async function addMesocycleViaUI(page, name, length = 7, startDate = null) {
  await page.locator('input[placeholder*="4-Week"]').fill(name);
  await page.locator('input[type="number"]').fill(String(length));
  if (startDate) {
    await page.locator('input[type="date"]').fill(startDate);
  }
  await page.click('button:has-text("+ Add Mesocycle")');
  await page.waitForTimeout(500);
}

/**
 * Click "View" on a mesocycle row and wait for the calendar page.
 */
export async function viewMesocycle(page, name) {
  const row = page.locator('tr', { hasText: name });
  await row.locator('a:has-text("View")').click();
  await page.waitForSelector('.day-grid', { timeout: 5000 });
}

/**
 * Add a workout to a day cell on the MesocyclePage.
 */
export async function addWorkoutViaUI(page, dayIndex, name) {
  const cells = page.locator('.day-cell');
  await cells.nth(dayIndex).locator('button:has-text("+ Add workout")').click();
  await page.waitForSelector('.modal-box');
  await page.locator('.modal-box input').fill(name);
  await page.locator('.modal-box button:has-text("Save")').click();
  await page.waitForTimeout(500);
}

/**
 * Click a workout chip to navigate to the WorkoutPage.
 */
export async function openWorkout(page, name) {
  await page.locator('.workout-chip', { hasText: name }).click();
  await page.waitForSelector('.exercise-block, .empty-state', { timeout: 5000 });
}

/**
 * Add an exercise to a workout.
 */
export async function addExerciseViaUI(page, exerciseName, variationName = null) {
  await page.click('button:has-text("+ Add Exercise")');
  await page.waitForSelector('.modal-box');
  await page.locator('.modal-box select').first().selectOption({ label: exerciseName });
  if (variationName) {
    await page.locator('.modal-box select').last().selectOption({ label: variationName });
  }
  await page.locator('.modal-box button:has-text("Add")').click();
  await page.waitForTimeout(500);
}

/**
 * Add a set to an exercise block of a given type.
 */
export async function addSetViaUI(page, type = 'normal') {
  const select = page.locator('.exercise-block select').last();
  await select.selectOption(type);
  await page.waitForTimeout(300);
}

/**
 * Fill out a set row (reps, weight, RIR).
 */
export async function fillSetRow(page, exerciseIndex, setIndex, { reps, weight, rir }) {
  const rows = page.locator('.exercise-block').nth(exerciseIndex).locator('.set-table tbody tr');
  const row = rows.nth(setIndex);
  if (reps !== undefined) {
    await row.locator('input').nth(0).fill(String(reps));
  }
  if (weight !== undefined) {
    await row.locator('input').nth(1).fill(String(weight));
  }
  if (rir !== undefined) {
    await row.locator('input').nth(2).fill(String(rir));
  }
  await page.waitForTimeout(300);
}
