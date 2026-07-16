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
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Mesocycle', 'Workouts', 'Sets']);
    const metadata = workbook.getWorksheet('Mesocycle')!;
    const workouts = workbook.getWorksheet('Workouts')!;
    const sets = workbook.getWorksheet('Sets')!;
    expect(metadata.getCell('A1').font.bold).toBe(true);
    expect(metadata.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FF17365D' } });
    expect(metadata.getCell('B5').numFmt).toBe('yyyy-mm-dd');
    expect((metadata.getCell('B5').value as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(metadata.getRow(8).hidden).toBe(true);
    expect(workouts.autoFilter).toBeTruthy();
    expect(workouts.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(workouts.getColumn(1).width).toBe(18);
    expect(sets.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 1 });
    expect(sets.getColumn(12).hidden).toBe(true);
    expect(sets.getCell('F2').dataValidation).toMatchObject({ type: 'list' });
    expect(sets.getCell('G2').numFmt).toBe('0');
    expect(sets.getCell('I2').numFmt).toBe('0.##');

    metadata.getCell('B4').value = 'Imported Block';
    metadata.getCell('B5').value = new Date('2026-01-15T00:00:00.000Z');
    metadata.getCell('B6').value = 3;
    workouts.getCell('C2').value = 'Imported Push';
    sets.getCell('G2').value = 10;
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
    const sets = workbook.getWorksheet('Sets')!;
    for (const row of [2, 3]) {
      sets.getCell(`C${row}`).value = 'Paused';
      sets.getCell(`M${row}`).value = 999999;
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
    const sets = workbook.getWorksheet('Sets')!;
    const firstExerciseOrder = sets.getCell('D2').value as number;

    sets.getCell('D3').value = firstExerciseOrder + 10;
    const inconsistentBlock = await workbook.xlsx.writeBuffer();
    sets.getCell('D3').value = firstExerciseOrder;
    sets.getCell('D4').value = firstExerciseOrder;
    const reusedOrder = await workbook.xlsx.writeBuffer();

    await page.locator('input[type="file"]').setInputFiles({ name: 'inconsistent-block.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(inconsistentBlock) });
    await expect(page.locator('.alert-danger')).toContainText('different Exercise Order than the other sets in its exercise block');

    await page.locator('input[type="file"]').setInputFiles({ name: 'reused-order.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(reusedOrder) });
    await expect(page.locator('.alert-danger')).toContainText(`reuses Exercise Order ${firstExerciseOrder} for a different exercise block`);
    await expect(page.locator('.page-header h1')).toHaveText('Original Block');
    await expect(page.locator('.day-cell').first()).toContainText('Push A');
  });
});
