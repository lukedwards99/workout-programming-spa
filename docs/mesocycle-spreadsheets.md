# Mesocycle spreadsheets

LiftLog can export one mesocycle as an editable Excel workbook (`.xlsx`) and import it back into that same mesocycle. Use this for bulk editing when working in a spreadsheet is more convenient than editing workouts one at a time.

## Export a workbook

1. Open the mesocycle schedule.
2. Select **Export Excel**.
3. Save the downloaded `.xlsx` file before editing it.

The workbook contains a **Mesocycle** sheet plus one worksheet per workout. It includes hidden reference fields that identify the source program and mesocycle.

## Edit safely

The workbook marks editable cells in pale coral and reference-only cells in gray. Preserve the workbook structure, sheet types, and hidden identifiers.

You can edit:

- mesocycle name, start date, length, and notes;
- workout name, day, notes, and sort order; and
- set exercise order, set number, set type, planned reps, actual reps, weight, RIR, and notes.

Exercise names, variation names, exercise IDs, and variation IDs are reference fields. Do not change the hidden IDs. Keep each exercise block's order consistent across its sets, and do not assign the same exercise order to different blocks in the same workout.

Supported set types are `warmup`, `normal`, `dropset`, `failure`, and `rest-pause`. Reps and RIR must be whole numbers; planned and actual reps cannot be negative. Weight may be a non-negative decimal. The workbook does not accept formulas.

## Import a workbook

1. Return to the same mesocycle from which the workbook was exported.
2. Select **Import Excel** and choose the `.xlsx` file.
3. Resolve any validation error before continuing.
4. Confirm the replacement only after you have a current program backup.

> **Warning:** importing replaces all workouts and sets in the target mesocycle. The replacement is atomic: a validation or import failure leaves the existing mesocycle unchanged, but a confirmed successful import cannot be undone from within LiftLog.

The importer accepts only supported LiftLog exports for the current program and mesocycle. A workbook exported for a different mesocycle, an old combined-layout workbook, missing sheets, unsupported sheet types, invalid rows, or formulas is rejected.

If an imported set references an exercise or variation that no longer exists locally but still has a visible name in the workbook, LiftLog can recreate it during the import. Otherwise, restore the missing reference or use a fresh export.

## Recover from problems

Keep the original downloaded workbook untouched until the replacement succeeds. If import validation fails, correct the indicated workbook issue and retry; no changes have been applied yet. If you need to discard an imported result, restore the complete program backup you made before importing. See [Data management and backups](data-management.md).
