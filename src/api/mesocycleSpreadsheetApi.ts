import type * as ExcelJS from 'exceljs';
import type { Mesocycle, WorkoutSetType } from '../types/domain';
import { exercisesApi } from './exercisesApi';
import { exerciseVariationsApi } from './exerciseVariationsApi';
import { execSQL, queryAll, saveNow } from '../db/databaseService';

const FORMAT_VERSION = 2;
const WORKBOOK_TYPE = 'mesocycle-export';
const WORKOUT_SHEET_TYPE = 'workout';
const WORKOUT_SET_HEADER_ROW = 10;
const SET_TYPES: WorkoutSetType[] = ['warmup', 'normal', 'dropset', 'failure', 'rest-pause'];
const MAX_VALIDATION_ROWS = 1000;
const NAVY = '17365D';
const CORAL = 'E76F51';
const PALE_EDITABLE = 'FFF4EC';
const PALE_REFERENCE = 'EEF1F4';
const PALE_ALTERNATE = 'F7F9FB';
const BORDER = 'D8DEE6';

type CellValue = string | number | Date | boolean | null | undefined;

interface ExportSetRow {
  'Workout Ref': string;
  Exercise: string;
  Variation: string;
  'Exercise Order': number;
  'Set #': number;
  'Set Type': WorkoutSetType;
  'Planned Reps': number | null;
  'Actual Reps': number | null;
  Weight: number | null;
  RIR: number | null;
  Notes: string;
  'Exercise ID': number;
  'Variation ID': number | null;
}

interface ExportWorkoutRow {
  'Workout Ref': string;
  Day: number;
  Name: string;
  Notes: string;
  'Sort Order': number;
}

export interface ImportedMesocycleWorkbook {
  mesocycle: { name: string; mesocycleLength: number; startDate: string; notes: string };
  workouts: Array<{ ref: string; dayOffset: number; name: string; notes: string; sortOrder: number }>;
  sets: Array<{
    workoutRef: string; exerciseId: number; exerciseName: string; variationId: number | null; variationName: string; exerciseOrder: number;
    setNumber: number; setType: WorkoutSetType; plannedReps: number | null; actualReps: number | null;
    weight: number | null; rir: number | null; notes: string;
  }>;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mesocycle';
}

function uniqueWorksheetName(day: number, workoutName: string, usedNames: Set<string>): string {
  const sanitized = `Day ${day} - ${workoutName}`
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim() || `Day ${day} - Workout`;
  let name = sanitized.slice(0, 31).trim();
  let suffixNumber = 2;
  while (usedNames.has(name.toLowerCase())) {
    const suffix = ` (${suffixNumber++})`;
    name = `${sanitized.slice(0, 31 - suffix.length).trim()}${suffix}`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

async function loadExcelJS(): Promise<typeof ExcelJS> {
  return (await import('exceljs')).default as unknown as typeof ExcelJS;
}

function fill(argb: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${argb}` } };
}

const bottomBorder: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: `FF${BORDER}` } } };

function styleHeader(row: ExcelJS.Row): void {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(NAVY);
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = bottomBorder;
  });
}

function styleTable(sheet: ExcelJS.Worksheet, header: string[], widths: number[], referenceColumns: number[], editableColumns: number[], headerRow = 1): void {
  sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  sheet.columns = widths.map((width) => ({ width }));
  sheet.getRow(headerRow).values = header;
  styleHeader(sheet.getRow(headerRow));
  sheet.autoFilter = { from: `A${headerRow}`, to: `${sheet.getColumn(header.length).letter}${headerRow}` };
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = bottomBorder;
      if (referenceColumns.includes(column)) cell.fill = fill(PALE_REFERENCE);
      else if (editableColumns.includes(column)) cell.fill = fill(PALE_EDITABLE);
      else if (rowNumber % 2 === 0) cell.fill = fill(PALE_ALTERNATE);
    });
  }
}

function applyValidation(sheet: ExcelJS.Worksheet, column: number, validation: ExcelJS.DataValidation, startRow = 2): void {
  for (let row = startRow; row <= MAX_VALIDATION_ROWS; row++) sheet.getCell(row, column).dataValidation = validation;
}

function setTypeFill(type: WorkoutSetType): string {
  return ({ warmup: 'E9F1FB', normal: 'FFF4EC', dropset: 'FDE2E0', failure: 'FADBD8', 'rest-pause': 'FCECC9' })[type];
}

function downloadWorkbook(buffer: ArrayBuffer, filename: string): void {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportMesocycleWorkbook(programId: number, programName: string, mesocycle: Mesocycle): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Workout Programming';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const workoutRows: ExportWorkoutRow[] = queryAll(
    'SELECT id, name, day_offset, notes, sort_order FROM workouts WHERE mesocycle_id = ? ORDER BY day_offset, sort_order, id', [mesocycle.id]
  ).map((row) => ({
    'Workout Ref': `workout-${row.id as number}`, Day: (row.day_offset as number) + 1, Name: row.name as string,
    Notes: (row.notes as string | null) || '', 'Sort Order': row.sort_order as number,
  }));
  const setRows: ExportSetRow[] = queryAll(
    `SELECT ws.*, w.id AS workout_source_id, e.name AS exercise_name, ev.name AS variation_name
     FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id JOIN exercises e ON e.id = ws.exercise_id
     LEFT JOIN exercise_variations ev ON ev.id = ws.exercise_variation_id WHERE w.mesocycle_id = ?
     ORDER BY w.day_offset, w.sort_order, w.id, ws.exercise_order, ws.set_number, ws.id`, [mesocycle.id]
  ).map((row) => ({
    'Workout Ref': `workout-${row.workout_source_id as number}`, Exercise: row.exercise_name as string,
    Variation: (row.variation_name as string | null) || '', 'Exercise Order': row.exercise_order as number,
    'Set #': row.set_number as number, 'Set Type': row.set_type as WorkoutSetType,
    'Planned Reps': row.planned_reps as number | null, 'Actual Reps': row.actual_reps as number | null,
    Weight: row.weight as number | null, RIR: row.rir as number | null, Notes: (row.notes as string | null) || '',
    'Exercise ID': row.exercise_id as number, 'Variation ID': row.exercise_variation_id as number | null,
  }));
  const setsByWorkout = new Map<string, ExportSetRow[]>();
  for (const setRow of setRows) {
    const rows = setsByWorkout.get(setRow['Workout Ref']) ?? [];
    rows.push(setRow);
    setsByWorkout.set(setRow['Workout Ref'], rows);
  }

  const metadata = workbook.addWorksheet('Mesocycle', { views: [{ showGridLines: false }] });
  metadata.columns = [{ width: 18 }, { width: 14 }, { width: 32 }, { width: 14 }, { width: 12 }, { width: 50 }];
  metadata.mergeCells('A1:F1');
  metadata.getCell('A1').value = `${programName} — ${mesocycle.name}`;
  metadata.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  metadata.getCell('A1').fill = fill(NAVY);
  metadata.getCell('A1').alignment = { vertical: 'middle' };
  metadata.getRow(1).height = 28;
  metadata.mergeCells('A2:F2');
  metadata.getCell('A2').value = 'Edit the highlighted mesocycle fields and workout tabs, then import this workbook back into this same mesocycle.';
  metadata.getCell('A2').font = { name: 'Arial', size: 10, color: { argb: `FF${NAVY}` } };
  metadata.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
  metadata.getCell('A2').fill = fill('E9F1FB');
  metadata.getRow(2).height = 36;
  metadata.getRow(3).values = ['Field', 'Value'];
  styleHeader(metadata.getRow(3));
  const startDate = new Date(`${mesocycle.start_date}T00:00:00Z`);
  const metadataRows: Array<[string, CellValue]> = [
    ['Name', mesocycle.name], ['Start Date', startDate], ['Mesocycle Length', mesocycle.mesocycle_length],
    ['Notes', mesocycle.notes || ''], ['Workbook Type', WORKBOOK_TYPE], ['Format Version', FORMAT_VERSION],
    ['Source Program ID', programId], ['Source Mesocycle ID', mesocycle.id],
  ];
  metadataRows.forEach(([field, value], index) => {
    const row = metadata.getRow(index + 4);
    row.values = [field, value];
    row.height = field === 'Notes' ? 36 : 22;
    row.eachCell((cell, column) => {
      cell.font = { name: 'Arial', size: 10, bold: column === 1 };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = bottomBorder;
      cell.fill = fill(index < 4 ? (column === 1 ? PALE_REFERENCE : PALE_EDITABLE) : PALE_REFERENCE);
    });
  });
  metadata.getCell('B5').numFmt = 'yyyy-mm-dd';
  for (const rowNumber of [8, 9, 10, 11]) metadata.getRow(rowNumber).hidden = true;
  metadata.getCell('A13').value = 'Legend';
  metadata.getCell('A13').font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  metadata.getCell('A13').fill = fill(CORAL);
  metadata.mergeCells('B13:F13');
  metadata.getCell('B13').value = 'Pale coral cells are editable. Gray cells are reference-only.';
  metadata.getCell('B13').font = { name: 'Arial', size: 10 };
  metadata.getCell('B13').alignment = { wrapText: true };
  metadata.getCell('B13').fill = fill(PALE_EDITABLE);

  metadata.mergeCells('A15:F15');
  metadata.getCell('A15').value = 'Workout Overview';
  metadata.getCell('A15').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  metadata.getCell('A15').fill = fill(NAVY);
  metadata.getRow(16).values = ['Day', 'Date', 'Workout', 'Exercises', 'Sets', 'Notes'];
  styleHeader(metadata.getRow(16));
  workoutRows.forEach((workout, index) => {
    const workoutSets = setsByWorkout.get(workout['Workout Ref']) ?? [];
    const exerciseBlocks = new Set(workoutSets.map((set) => `${set['Exercise ID']}:${set['Variation ID'] ?? ''}`));
    const workoutDate = new Date(startDate);
    workoutDate.setUTCDate(workoutDate.getUTCDate() + workout.Day - 1);
    const row = metadata.getRow(17 + index);
    row.values = [workout.Day, workoutDate, workout.Name, exerciseBlocks.size, workoutSets.length, workout.Notes];
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = bottomBorder;
      cell.fill = fill(index % 2 === 0 ? PALE_REFERENCE : PALE_ALTERNATE);
    });
    row.getCell(1).numFmt = '0';
    row.getCell(2).numFmt = 'yyyy-mm-dd';
    row.getCell(4).numFmt = '0';
    row.getCell(5).numFmt = '0';
  });
  metadata.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  metadata.pageSetup.printArea = `A1:F${Math.max(17, 16 + workoutRows.length)}`;
  metadata.pageSetup.printTitlesRow = '16:16';

  const usedSheetNames = new Set<string>(['mesocycle']);
  const setHeader = ['Exercise', 'Variation', 'Exercise Order', 'Set #', 'Set Type', 'Planned Reps', 'Actual Reps', 'Weight', 'RIR', 'Notes', 'Exercise ID', 'Variation ID'];
  for (const workout of workoutRows) {
    const sheetName = uniqueWorksheetName(workout.Day, workout.Name, usedSheetNames);
    const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = workout.Name;
    sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = fill(NAVY);
    sheet.getCell('A1').alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 28;
    sheet.mergeCells('A2:L2');
    sheet.getCell('A2').value = 'Edit the highlighted workout fields and set values. Exercise names and hidden IDs are reference-only.';
    sheet.getCell('A2').font = { name: 'Arial', size: 10, color: { argb: `FF${NAVY}` } };
    sheet.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
    sheet.getCell('A2').fill = fill('E9F1FB');
    sheet.getRow(2).height = 32;
    sheet.getRow(3).values = ['Field', 'Value'];
    styleHeader(sheet.getRow(3));
    const workoutMetadata: Array<[string, CellValue]> = [
      ['Name', workout.Name], ['Day', workout.Day], ['Notes', workout.Notes], ['Sort Order', workout['Sort Order']],
      ['Workout Ref', workout['Workout Ref']], ['Sheet Type', WORKOUT_SHEET_TYPE],
    ];
    workoutMetadata.forEach(([field, value], index) => {
      const row = sheet.getRow(index + 4);
      row.values = [field, value];
      row.height = field === 'Notes' ? 36 : 22;
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.font = { name: 'Arial', size: 10, bold: column === 1 };
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = bottomBorder;
        cell.fill = fill(index < 4 ? (column === 1 ? PALE_REFERENCE : PALE_EDITABLE) : PALE_REFERENCE);
      });
    });
    sheet.getRow(8).hidden = true;
    sheet.getRow(9).hidden = true;
    sheet.getCell('B5').numFmt = '0';
    sheet.getCell('B7').numFmt = '0';
    sheet.getCell('B5').dataValidation = { type: 'whole', operator: 'between', formulae: [1, mesocycle.mesocycle_length], allowBlank: false, showErrorMessage: true, error: `Day must be an integer from 1 through ${mesocycle.mesocycle_length}.` };
    sheet.getCell('B7').dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: false, showErrorMessage: true, error: 'Sort Order must be a non-negative integer.' };

    const workoutSets = setsByWorkout.get(workout['Workout Ref']) ?? [];
    sheet.getRow(WORKOUT_SET_HEADER_ROW).values = setHeader;
    workoutSets.forEach((set) => sheet.addRow([
      set.Exercise, set.Variation, set['Exercise Order'], set['Set #'], set['Set Type'], set['Planned Reps'],
      set['Actual Reps'], set.Weight, set.RIR, set.Notes, set['Exercise ID'], set['Variation ID'],
    ]));
    styleTable(sheet, setHeader, [30, 24, 14, 10, 14, 14, 14, 12, 10, 42, 14, 14], [1, 2, 11, 12], [3, 4, 5, 6, 7, 8, 9, 10], WORKOUT_SET_HEADER_ROW);
    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: WORKOUT_SET_HEADER_ROW, showGridLines: false }];
    sheet.getColumn(11).hidden = true;
    sheet.getColumn(12).hidden = true;
    for (let rowNumber = WORKOUT_SET_HEADER_ROW + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const setType = sheet.getCell(rowNumber, 5).value as WorkoutSetType;
      sheet.getCell(rowNumber, 5).fill = fill(setTypeFill(setType));
      sheet.getCell(rowNumber, 5).font = { name: 'Arial', size: 10, bold: true, color: { argb: `FF${NAVY}` } };
    }
    applyValidation(sheet, 3, { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: false, showErrorMessage: true, error: 'Exercise Order must be a non-negative integer.' }, WORKOUT_SET_HEADER_ROW + 1);
    applyValidation(sheet, 4, { type: 'whole', operator: 'greaterThanOrEqual', formulae: [1], allowBlank: false, showErrorMessage: true, error: 'Set # must be an integer of at least 1.' }, WORKOUT_SET_HEADER_ROW + 1);
    applyValidation(sheet, 5, { type: 'list', formulae: [`"${SET_TYPES.join(',')}"`], allowBlank: false, showErrorMessage: true, error: 'Choose a supported Set Type.' }, WORKOUT_SET_HEADER_ROW + 1);
    for (const column of [6, 7]) applyValidation(sheet, column, { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Reps must be a non-negative integer.' }, WORKOUT_SET_HEADER_ROW + 1);
    applyValidation(sheet, 8, { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'Weight must be a non-negative number.' }, WORKOUT_SET_HEADER_ROW + 1);
    applyValidation(sheet, 9, { type: 'whole', allowBlank: true, formulae: [], showErrorMessage: true, error: 'RIR must be an integer.' }, WORKOUT_SET_HEADER_ROW + 1);
    for (const column of [3, 4, 6, 7, 9, 11, 12]) sheet.getColumn(column).numFmt = '0';
    sheet.getColumn(8).numFmt = '0.##';
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printArea = `A1:J${Math.max(WORKOUT_SET_HEADER_ROW + 1, WORKOUT_SET_HEADER_ROW + workoutSets.length)}`;
    sheet.pageSetup.printTitlesRow = `${WORKOUT_SET_HEADER_ROW}:${WORKOUT_SET_HEADER_ROW}`;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(buffer as unknown as ArrayBuffer, `mesocycle-${safeFileName(programName)}-${safeFileName(mesocycle.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function asText(value: CellValue): string { return value == null ? '' : String(value).trim(); }
function asRequiredText(value: CellValue, label: string): string { const text = asText(value); if (!text) throw new Error(`${label} is required.`); return text; }
function asInteger(value: CellValue, label: string, minimum?: number): number {
  const parsed = typeof value === 'number' ? value : Number(asText(value));
  if (!Number.isInteger(parsed) || (minimum != null && parsed < minimum)) throw new Error(`${label} must be ${minimum != null ? `an integer of at least ${minimum}` : 'an integer'}.`);
  return parsed;
}
function asNullableNumber(value: CellValue, label: string, integer = false, minimum?: number): number | null {
  if (value == null || asText(value) === '') return null;
  const parsed = typeof value === 'number' ? value : Number(asText(value));
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)) || (minimum != null && parsed < minimum)) throw new Error(`${label} is invalid.`);
  return parsed;
}
function excelSerialToIso(value: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
function asIsoDate(value: CellValue): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  if (typeof value === 'number') return excelSerialToIso(value);
  const text = asRequiredText(value, 'Start Date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00`).getTime())) throw new Error('Start Date must use YYYY-MM-DD.');
  return text;
}
function cellValue(cell: ExcelJS.Cell): CellValue {
  const value = cell.value;
  if (value != null && typeof value === 'object' && 'result' in value) return value.result as CellValue;
  return value as CellValue;
}
function getRows(sheet: ExcelJS.Worksheet, name: string, headerRow = 1): Record<string, CellValue>[] {
  if (!sheet) throw new Error(`Workbook is missing the ${name} sheet.`);
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => asText(cellValue(sheet.getRow(headerRow).getCell(index + 1))));
  const rows: Record<string, CellValue>[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = headers.reduce<Record<string, CellValue>>((result, header, index) => { result[header] = cellValue(row.getCell(index + 1)); return result; }, {});
    if ((Object.values(values) as CellValue[]).some((value) => asText(value) !== '')) rows.push(values);
  }
  return rows;
}
function rejectFormulas(sheet: ExcelJS.Worksheet, name: string): void {
  sheet.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (cell) => { if (cell.formula) throw new Error(`${name} cannot contain formulas.`); }));
}
function metadataValue(rows: Record<string, CellValue>[], field: string): CellValue { return rows.find((candidate) => asText(candidate.Field) === field)?.Value; }

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

function validateExerciseOrders(sets: ImportedMesocycleWorkbook['sets']): void {
  const blockOrdersByWorkout = new Map<string, Map<string, number>>();
  const blocksByWorkoutOrder = new Map<string, Map<number, string>>();
  sets.forEach((set, index) => {
    const blockKey = `${set.exerciseId}:${set.variationId ?? ''}`;
    const blockOrders = blockOrdersByWorkout.get(set.workoutRef) ?? new Map<string, number>();
    const existingOrder = blockOrders.get(blockKey);
    if (existingOrder !== undefined && existingOrder !== set.exerciseOrder) {
      throw new Error(`Sets row ${index + 2} uses a different Exercise Order than the other sets in its exercise block.`);
    }

    const orderedBlocks = blocksByWorkoutOrder.get(set.workoutRef) ?? new Map<number, string>();
    const existingBlock = orderedBlocks.get(set.exerciseOrder);
    if (existingBlock !== undefined && existingBlock !== blockKey) {
      throw new Error(`Sets row ${index + 2} reuses Exercise Order ${set.exerciseOrder} for a different exercise block in the same workout.`);
    }

    blockOrders.set(blockKey, set.exerciseOrder);
    orderedBlocks.set(set.exerciseOrder, blockKey);
    blockOrdersByWorkout.set(set.workoutRef, blockOrders);
    blocksByWorkoutOrder.set(set.workoutRef, orderedBlocks);
  });
}

export async function validateMesocycleWorkbook(file: File, programId: number, mesocycleId: number): Promise<ImportedMesocycleWorkbook> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Please select an .xlsx workbook.');
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer() as never);
  const metadataSheet = workbook.getWorksheet('Mesocycle');
  if (!metadataSheet) throw new Error('Workbook must include a Mesocycle sheet.');
  rejectFormulas(metadataSheet, 'Mesocycle sheet');
  const metadata = getRows(metadataSheet, 'Mesocycle', 3);
  if (asText(metadataValue(metadata, 'Workbook Type')) !== WORKBOOK_TYPE || asInteger(metadataValue(metadata, 'Format Version'), 'Format Version', 1) !== FORMAT_VERSION) throw new Error('This is not a supported mesocycle export workbook.');
  if (asInteger(metadataValue(metadata, 'Source Program ID'), 'Source Program ID', 1) !== programId || asInteger(metadataValue(metadata, 'Source Mesocycle ID'), 'Source Mesocycle ID', 1) !== mesocycleId) throw new Error('This workbook belongs to a different mesocycle.');
  const importedMesocycle = { name: asRequiredText(metadataValue(metadata, 'Name'), 'Mesocycle name'), startDate: asIsoDate(metadataValue(metadata, 'Start Date')), mesocycleLength: asInteger(metadataValue(metadata, 'Mesocycle Length'), 'Mesocycle Length', 1), notes: asText(metadataValue(metadata, 'Notes')) };
  const workoutSheets = workbook.worksheets.filter((sheet) => sheet.name !== 'Mesocycle');
  const workouts: ImportedMesocycleWorkbook['workouts'] = [];
  const sets: ImportedMesocycleWorkbook['sets'] = [];
  const refs = new Set<string>();
  for (const sheet of workoutSheets) {
    rejectFormulas(sheet, `${sheet.name} sheet`);
    const workoutMetadata = getRows(sheet, sheet.name, 3);
    if (asText(metadataValue(workoutMetadata, 'Sheet Type')) !== WORKOUT_SHEET_TYPE) throw new Error(`Workbook contains unsupported worksheet "${sheet.name}".`);
    const ref = asRequiredText(metadataValue(workoutMetadata, 'Workout Ref'), `${sheet.name} Workout Ref`);
    const workout = {
      ref,
      dayOffset: asInteger(metadataValue(workoutMetadata, 'Day'), `${sheet.name} Day`, 1) - 1,
      name: asRequiredText(metadataValue(workoutMetadata, 'Name'), `${sheet.name} Name`),
      notes: asText(metadataValue(workoutMetadata, 'Notes')),
      sortOrder: asInteger(metadataValue(workoutMetadata, 'Sort Order'), `${sheet.name} Sort Order`, 0),
    };
    if (workout.dayOffset >= importedMesocycle.mesocycleLength) throw new Error(`Workout "${workout.name}" is outside the mesocycle length.`);
    if (refs.has(workout.ref)) throw new Error(`Workout Ref "${workout.ref}" is duplicated.`);
    refs.add(workout.ref);
    workouts.push(workout);

    getRows(sheet, sheet.name, WORKOUT_SET_HEADER_ROW).forEach((row, index) => {
      const rowNumber = WORKOUT_SET_HEADER_ROW + index + 1;
      const label = `${sheet.name} row ${rowNumber}`;
      const exerciseId = asInteger(row['Exercise ID'], `${label} Exercise ID`, 1);
      const exerciseName = asText(row.Exercise);
      const variationId = asNullableNumber(row['Variation ID'], `${label} Variation ID`, true, 1);
      const variationName = asText(row.Variation);
      const exercise = exercisesApi.get(exerciseId);
      if (!exercise && !exerciseName) throw new Error(`${label} references a missing exercise without an exercise name.`);
      if (variationId != null) {
        const variation = exerciseVariationsApi.get(variationId);
        if (variation && exercise && variation.exercise_id !== exerciseId) throw new Error(`${label} references an invalid exercise variation.`);
        if (!variation && !variationName) throw new Error(`${label} references a missing exercise variation without a variation name.`);
      }
      const setType = asRequiredText(row['Set Type'], `${label} Set Type`) as WorkoutSetType;
      if (!SET_TYPES.includes(setType)) throw new Error(`${label} has an unsupported Set Type.`);
      sets.push({ workoutRef: ref, exerciseId, exerciseName, variationId, variationName, exerciseOrder: asInteger(row['Exercise Order'], `${label} Exercise Order`, 0), setNumber: asInteger(row['Set #'], `${label} Set #`, 1), setType, plannedReps: asNullableNumber(row['Planned Reps'], `${label} Planned Reps`, true, 0), actualReps: asNullableNumber(row['Actual Reps'], `${label} Actual Reps`, true, 0), weight: asNullableNumber(row.Weight, `${label} Weight`, false, 0), rir: asNullableNumber(row.RIR, `${label} RIR`, true), notes: asText(row.Notes) });
    });
  }
  validateExerciseOrders(sets);
  return { mesocycle: importedMesocycle, workouts, sets };
}

export async function replaceMesocycleFromWorkbook(mesocycleId: number, imported: ImportedMesocycleWorkbook): Promise<void> {
  const workoutIds = new Map<string, number>(); execSQL('BEGIN');
  try {
    const exerciseIds = new Map<number, number>();
    const variationIds = new Map<string, number | null>();
    let importedExercisesGroupId: number | null = null;

    const findOrCreateImportedExercisesGroup = (): number => {
      if (importedExercisesGroupId != null) return importedExercisesGroupId;
      const existing = queryAll('SELECT id FROM exercise_groups WHERE name = ?', ['Imported Exercises'])[0];
      if (existing) return importedExercisesGroupId = existing.id as number;
      execSQL('INSERT INTO exercise_groups (name, notes) VALUES (?, ?)', ['Imported Exercises', null]);
      return importedExercisesGroupId = queryAll('SELECT last_insert_rowid() AS id')[0].id as number;
    };

    const resolveExerciseId = (sourceId: number, name: string): number => {
      const cached = exerciseIds.get(sourceId);
      if (cached != null) return cached;
      const sourceExercise = queryAll('SELECT id FROM exercises WHERE id = ?', [sourceId])[0];
      if (sourceExercise) return sourceId;
      const matchingExercise = queryAll(
        'SELECT id FROM exercises WHERE lower(trim(name)) = ? ORDER BY id LIMIT 1', [normalizedName(name)]
      )[0];
      if (matchingExercise) {
        const matchingId = matchingExercise.id as number;
        exerciseIds.set(sourceId, matchingId);
        return matchingId;
      }
      execSQL('INSERT INTO exercises (exercise_group_id, name, tutorial_url, notes) VALUES (?, ?, ?, ?)', [findOrCreateImportedExercisesGroup(), name, null, null]);
      const createdId = queryAll('SELECT last_insert_rowid() AS id')[0].id as number;
      exerciseIds.set(sourceId, createdId);
      return createdId;
    };

    const resolveVariationId = (sourceVariationId: number | null, variationName: string, exerciseId: number): number | null => {
      if (sourceVariationId == null && !variationName) return null;
      const cacheKey = `${sourceVariationId ?? ''}:${exerciseId}:${normalizedName(variationName)}`;
      if (variationIds.has(cacheKey)) return variationIds.get(cacheKey)!;
      if (sourceVariationId != null) {
        const sourceVariation = queryAll('SELECT id FROM exercise_variations WHERE id = ? AND exercise_id = ?', [sourceVariationId, exerciseId])[0];
        if (sourceVariation) {
          const sourceId = sourceVariation.id as number;
          variationIds.set(cacheKey, sourceId);
          return sourceId;
        }
      }
      const matchingVariation = queryAll(
        'SELECT id FROM exercise_variations WHERE exercise_id = ? AND lower(trim(name)) = ? ORDER BY id LIMIT 1', [exerciseId, normalizedName(variationName)]
      )[0];
      if (matchingVariation) {
        const matchingId = matchingVariation.id as number;
        variationIds.set(cacheKey, matchingId);
        return matchingId;
      }
      if (!variationName) throw new Error('Workbook references a missing exercise variation without a variation name.');
      execSQL('INSERT INTO exercise_variations (exercise_id, name, is_primary, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)', [exerciseId, variationName, 0, null, null]);
      const createdId = queryAll('SELECT last_insert_rowid() AS id')[0].id as number;
      variationIds.set(cacheKey, createdId);
      return createdId;
    };

    execSQL('UPDATE mesocycles SET name = ?, mesocycle_length = ?, start_date = ?, notes = ? WHERE id = ?', [imported.mesocycle.name, imported.mesocycle.mesocycleLength, imported.mesocycle.startDate, imported.mesocycle.notes || null, mesocycleId]);
    execSQL('DELETE FROM workouts WHERE mesocycle_id = ?', [mesocycleId]);
    for (const workout of imported.workouts) { execSQL('INSERT INTO workouts (mesocycle_id, name, day_offset, notes, sort_order) VALUES (?, ?, ?, ?, ?)', [mesocycleId, workout.name, workout.dayOffset, workout.notes || null, workout.sortOrder]); const id = queryAll('SELECT last_insert_rowid() AS id')[0].id as number; workoutIds.set(workout.ref, id); }
    for (const set of imported.sets) {
      const workoutId = workoutIds.get(set.workoutRef);
      if (!workoutId) throw new Error('Workbook references an unknown workout.');
      const exerciseId = resolveExerciseId(set.exerciseId, set.exerciseName);
      const variationId = resolveVariationId(set.variationId, set.variationName, exerciseId);
      execSQL(`INSERT INTO workout_sets (workout_id, exercise_id, exercise_variation_id, exercise_order, set_number, set_type, planned_reps, actual_reps, weight, rir, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [workoutId, exerciseId, variationId, set.exerciseOrder, set.setNumber, set.setType, set.plannedReps, set.actualReps, set.weight, set.rir, set.notes || null]);
    }
    execSQL('COMMIT');
  } catch (error) { execSQL('ROLLBACK'); throw error; }
  await saveNow();
}
