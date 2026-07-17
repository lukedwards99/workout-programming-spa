import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import {
  clearDatabase, createProgramViaUI, viewProgram, addMesocycleViaUI, viewMesocycle,
  addWorkoutViaUI, openWorkout, addExerciseGroupViaUI, addExerciseToLibraryViaUI,
  addExerciseViaUI, addSetViaUI, fillSetRow,
} from './setup';

test.describe('Mesocycle Excel round trip', () => {
  test.use({ timezoneId: 'America/Chicago' });

  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await createProgramViaUI(page, 'Excel Program');
    await viewProgram(page, 'Excel Program');
    await addMesocycleViaUI(page, 'Original Block', 7, '2026-01-01');
    await viewMesocycle(page, 'Original Block');
    const mesocycleUrl = page.url();

    const programId = mesocycleUrl.match(/\/programs\/(\d+)/)?.[1];
    await page.goto(`/programs/${programId}/exercises`);
    await page.waitForSelector('.nav-bar');
    await addExerciseGroupViaUI(page, 'Chest');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Bench Press');

    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await addWorkoutViaUI(page, 0, 'Push A');
    await openWorkout(page, 'Push A');
    await addExerciseViaUI(page, 'Bench Press');
    await fillSetRow(page, 0, 0, { plannedReps: 8, actualReps: 7, weight: 100, rir: 2 });
    await addSetViaUI(page, 'normal');
    await fillSetRow(page, 0, 1, { plannedReps: 6, actualReps: 5, weight: 110, rir: 1 });
    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await addWorkoutViaUI(page, 1, 'Recovery / Mobility: A Very Long Workout Name');
  });

  async function readDownload(download: import('@playwright/test').Download): Promise<ExcelJS.Workbook> {
    const source = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of source!) chunks.push(chunk as Buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks) as never);
    return workbook;
  }

  test('exports an editable workbook and atomically replaces the source mesocycle', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const workbook = await readDownload(download);
    expect(workbook.worksheets).toHaveLength(3);
    expect(workbook.worksheets[0].name).toBe('Mesocycle');
    expect(workbook.worksheets[1].name).toBe('Day 1 - Push A');
    expect(workbook.worksheets[2].name.length).toBeLessThanOrEqual(31);
    expect(workbook.worksheets[2].name).not.toMatch(/[\\/?*\[\]:]/);
    const metadata = workbook.getWorksheet('Mesocycle')!;
    const workout = workbook.worksheets[1];
    const emptyWorkout = workbook.worksheets[2];
    expect(metadata.getCell('A1').font.bold).toBe(true);
    expect(metadata.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF17365D' } });
    expect(metadata.getCell('B5').numFmt).toBe('yyyy-mm-dd');
    expect((metadata.getCell('B5').value as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(metadata.getRow(8).hidden).toBe(true);
    expect(metadata.getCell('A16').value).toBe('Day');
    expect(metadata.getCell('C17').value).toBe('Push A');
    expect(metadata.getCell('D17').value).toBe(1);
    expect(metadata.getCell('E17').value).toBe(2);
    expect(metadata.getCell('C18').value).toBe('Recovery / Mobility: A Very Long Workout Name');
    expect(metadata.getCell('D18').value).toBe(0);
    expect(metadata.getCell('E18').value).toBe(0);
    expect(metadata.pageSetup).toMatchObject({ orientation: 'landscape', fitToPage: true, fitToWidth: 1 });
    expect(workout.getCell('B4').value).toBe('Push A');
    expect(workout.getCell('B9').value).toBe('workout');
    expect(workout.autoFilter).toBeTruthy();
    expect(workout.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 10 });
    expect(workout.getColumn(11).hidden).toBe(true);
    expect(workout.getColumn(12).hidden).toBe(true);
    expect(workout.getCell('E11').dataValidation).toMatchObject({ type: 'list' });
    expect(workout.getCell('F11').numFmt).toBe('0');
    expect(workout.getCell('H11').numFmt).toBe('0.##');
    expect(workout.pageSetup).toMatchObject({ orientation: 'landscape', fitToPage: true, fitToWidth: 1, printArea: 'A1:J12' });
    expect(emptyWorkout.getCell('A10').value).toBe('Exercise');
    expect(emptyWorkout.getCell('A11').value).toBeNull();

    metadata.getCell('B4').value = 'Imported Block';
    metadata.getCell('B5').value = new Date('2026-01-15T00:00:00.000Z');
    metadata.getCell('B6').value = 3;
    workout.getCell('B4').value = 'Imported Push';
    workout.getCell('F11').value = 10;
    const edited = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'edited-mesocycle.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(edited),
    });
    await expect(page.locator('.modal-content')).toContainText('Replace Mesocycle from Excel');
    await page.locator('.modal-content button:has-text("Replace Mesocycle")').click();
    await expect(page.locator('.page-header h1')).toHaveText('Imported Block');
    await expect(page.getByText(/Started Jan 15, 2026/)).toBeVisible();
    await expect(page.locator('.day-cell')).toHaveCount(3);
    await expect(page.locator('.day-cell').first()).toContainText('Imported Push');
    await expect(page.locator('.day-cell').nth(1)).toContainText('Recovery / Mobility: A Very Long Workout Name');

    await openWorkout(page, 'Imported Push');
    await expect(page.locator('.exercise-block')).toHaveCount(1);
    await expect(page.locator('.exercise-block .set-table tbody tr')).toHaveCount(2);
    await expect(page.locator('td[data-label="Planned Reps"] input').first()).toHaveValue('10');
    await expect(page.locator('td[data-label="Actual Reps"] input').first()).toHaveValue('7');
  });

  test('recreates a deleted exercise only after import confirmation', async ({ page }) => {
    const mesocycleUrl = page.url();
    const programId = mesocycleUrl.match(/\/programs\/(\d+)/)?.[1];
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const source = Buffer.from(await (await readDownload(download)).xlsx.writeBuffer());

    await page.goto(`/programs/${programId}/exercises`);
    await page.waitForSelector('.nav-bar');
    const benchPress = page.locator('.ex-item', { hasText: 'Bench Press' });
    await benchPress.getByRole('button', { name: 'Del' }).click();
    await page.locator('.modal-content .btn-danger').click();
    await expect(page.locator('.ex-item')).toHaveCount(0);
    await page.waitForTimeout(500);

    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await page.locator('input[type="file"]').setInputFiles({ name: 'restore-exercise.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: source });
    await expect(page.locator('.modal-content')).toContainText('Replace Mesocycle from Excel');
    await page.locator('.modal-content button:has-text("Cancel")').click();

    await page.goto(`/programs/${programId}/exercises`);
    await page.waitForSelector('.nav-bar');
    await expect(page.locator('.ex-item')).toHaveCount(0);

    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await page.locator('input[type="file"]').setInputFiles({ name: 'restore-exercise.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: source });
    await page.locator('.modal-content button:has-text("Replace Mesocycle")').click();

    await page.goto(`/programs/${programId}/exercises`);
    await page.waitForSelector('.nav-bar');
    await expect(page.locator('.ex-item')).toHaveCount(1);
    await expect(page.locator('.ex-item')).toContainText('Bench Press');
    await expect(page.locator('.ex-item')).toContainText('Imported Exercises');

    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await openWorkout(page, 'Push A');
    await expect(page.locator('.exercise-block')).toHaveCount(1);
    await expect(page.locator('.exercise-block .set-table tbody tr')).toHaveCount(2);
  });

  test('recreates a missing variation from its visible workbook name', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const workbook = await readDownload(download);
    const workout = workbook.getWorksheet('Day 1 - Push A')!;
    for (const row of [2, 3]) {
      const setRow = row + 9;
      workout.getCell(`B${setRow}`).value = 'Paused';
      workout.getCell(`L${setRow}`).value = 999999;
    }
    const edited = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({ name: 'restore-variation.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(edited) });
    await expect(page.locator('.modal-content')).toContainText('Replace Mesocycle from Excel');
    await page.locator('.modal-content button:has-text("Replace Mesocycle")').click();

    await openWorkout(page, 'Push A');
    await expect(page.locator('.exercise-block')).toContainText('Paused');
    await expect(page.locator('.exercise-block .set-table tbody tr')).toHaveCount(2);
  });

  test('rejects a workbook exported for another mesocycle without changing the plan', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const workbook = await readDownload(download);
    workbook.getWorksheet('Mesocycle')!.getCell('B11').value = 999;
    const invalid = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({ name: 'wrong-source.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(invalid) });
    await expect(page.locator('.alert-danger')).toContainText('belongs to a different mesocycle');
    await expect(page.locator('.page-header h1')).toHaveText('Original Block');
    await expect(page.locator('.day-cell').first()).toContainText('Push A');
  });

  test('creates unique worksheet names for duplicate workouts', async ({ page }) => {
    await addWorkoutViaUI(page, 1, 'Recovery / Mobility: A Very Long Workout Name');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const workbook = await readDownload(download);
    const workoutNames = workbook.worksheets.slice(1).map((sheet) => sheet.name);

    expect(new Set(workoutNames.map((name) => name.toLowerCase())).size).toBe(workoutNames.length);
    expect(workoutNames.every((name) => name.length <= 31)).toBe(true);
    expect(workoutNames.every((name) => !/[\\/?*\[\]:]/.test(name))).toBe(true);
    expect(workoutNames.some((name) => name.endsWith('(2)'))).toBe(true);
  });

  test('rejects the old combined Workouts and Sets layout', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const workbook = await readDownload(download);
    for (const sheet of workbook.worksheets.slice(1)) workbook.removeWorksheet(sheet.id);
    workbook.addWorksheet('Workouts');
    workbook.addWorksheet('Sets');
    const oldLayout = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({ name: 'old-layout.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(oldLayout) });
    await expect(page.locator('.alert-danger')).toContainText('unsupported worksheet "Workouts"');
    await expect(page.locator('.page-header h1')).toHaveText('Original Block');
  });

  test('rejects inconsistent or reused exercise orders without changing the plan', async ({ page }) => {
    const mesocycleUrl = page.url();
    const programId = mesocycleUrl.match(/\/programs\/(\d+)/)?.[1];
    await page.goto(`/programs/${programId}/exercises`);
    await page.waitForSelector('.nav-bar');
    await addExerciseToLibraryViaUI(page, 'Chest', 'Incline Press');
    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');
    await openWorkout(page, 'Push A');
    await addExerciseViaUI(page, 'Incline Press');
    await page.goto(mesocycleUrl);
    await page.waitForSelector('.day-cell');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).click(),
    ]);
    const workbook = await readDownload(download);
    const workout = workbook.getWorksheet('Day 1 - Push A')!;
    const firstExerciseOrder = workout.getCell('C11').value as number;

    workout.getCell('C12').value = firstExerciseOrder + 10;
    const inconsistentBlock = await workbook.xlsx.writeBuffer();
    workout.getCell('C12').value = firstExerciseOrder;
    workout.getCell('C13').value = firstExerciseOrder;
    const reusedOrder = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({ name: 'inconsistent-block.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(inconsistentBlock) });
    await expect(page.locator('.alert-danger')).toContainText('different Exercise Order than the other sets in its exercise block');

    await page.locator('input[type="file"]').setInputFiles({ name: 'reused-order.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(reusedOrder) });
    await expect(page.locator('.alert-danger')).toContainText(`reuses Exercise Order ${firstExerciseOrder} for a different exercise block`);
    await expect(page.locator('.page-header h1')).toHaveText('Original Block');
    await expect(page.locator('.day-cell').first()).toContainText('Push A');
  });
});
