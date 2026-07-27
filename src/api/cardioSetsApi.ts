import type { CardioSet } from '../types/domain';
import type { CreateCardioSetInput, UpdateCardioSetInput } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { execSQL, lastInsertRowId, queryAll, queryOne } from '../db/databaseService';

function asCardioSet(row: SqlRow): CardioSet {
  return {
    id: row.id as number,
    workout_exercise_id: row.workout_exercise_id as number,
    set_number: row.set_number as number,
    planned_duration_seconds: row.planned_duration_seconds as number | null,
    actual_duration_seconds: row.actual_duration_seconds as number | null,
    planned_distance: row.planned_distance as number | null,
    actual_distance: row.actual_distance as number | null,
    distance_unit: row.distance_unit as CardioSet['distance_unit'],
    target_rpe: row.target_rpe as number | null,
    actual_rpe: row.actual_rpe as number | null,
    notes: row.notes as string | null,
  };
}

function assertCardioBlock(workoutExerciseId: number): void {
  const row = queryOne(
    `SELECT e.exercise_type
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.id = ?`,
    [workoutExerciseId],
  );
  if (!row) throw new Error('Workout exercise block not found.');
  if (row.exercise_type !== 'cardio') throw new Error('Cardio sets require a cardio exercise.');
}

export const cardioSetsApi = {
  list(workoutExerciseId: number): CardioSet[] {
    return queryAll(
      'SELECT * FROM cardio_sets WHERE workout_exercise_id = ? ORDER BY set_number, id',
      [workoutExerciseId],
    ).map(asCardioSet);
  },

  get(id: number): CardioSet | null {
    const row = queryOne('SELECT * FROM cardio_sets WHERE id = ?', [id]);
    return row ? asCardioSet(row) : null;
  },

  create({
    workoutExerciseId,
    setNumber,
    plannedDurationSeconds,
    actualDurationSeconds,
    plannedDistance,
    actualDistance,
    distanceUnit,
    targetRpe,
    actualRpe,
    notes,
  }: CreateCardioSetInput): CardioSet | null {
    assertCardioBlock(workoutExerciseId);
    execSQL(
      `INSERT INTO cardio_sets
        (workout_exercise_id, set_number, planned_duration_seconds,
         actual_duration_seconds, planned_distance, actual_distance,
         distance_unit, target_rpe, actual_rpe, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workoutExerciseId,
        setNumber,
        (plannedDurationSeconds as SqlValue) ?? null,
        (actualDurationSeconds as SqlValue) ?? null,
        (plannedDistance as SqlValue) ?? null,
        (actualDistance as SqlValue) ?? null,
        (distanceUnit as SqlValue) ?? null,
        (targetRpe as SqlValue) ?? null,
        (actualRpe as SqlValue) ?? null,
        notes || null,
      ],
    );
    return this.get(lastInsertRowId());
  },

  update(id: number, changes: UpdateCardioSetInput): CardioSet | null {
    const existing = this.get(id);
    if (!existing) return null;
    execSQL(
      `UPDATE cardio_sets
       SET set_number = ?, planned_duration_seconds = ?,
           actual_duration_seconds = ?, planned_distance = ?,
           actual_distance = ?, distance_unit = ?, target_rpe = ?,
           actual_rpe = ?, notes = ?
       WHERE id = ?`,
      [
        changes.set_number ?? existing.set_number,
        changes.planned_duration_seconds !== undefined
          ? changes.planned_duration_seconds
          : existing.planned_duration_seconds,
        changes.actual_duration_seconds !== undefined
          ? changes.actual_duration_seconds
          : existing.actual_duration_seconds,
        changes.planned_distance !== undefined ? changes.planned_distance : existing.planned_distance,
        changes.actual_distance !== undefined ? changes.actual_distance : existing.actual_distance,
        changes.distance_unit !== undefined ? changes.distance_unit : existing.distance_unit,
        changes.target_rpe !== undefined ? changes.target_rpe : existing.target_rpe,
        changes.actual_rpe !== undefined ? changes.actual_rpe : existing.actual_rpe,
        changes.notes !== undefined ? changes.notes || null : existing.notes,
        id,
      ],
    );
    return this.get(id);
  },

  delete(id: number): void {
    execSQL('DELETE FROM cardio_sets WHERE id = ?', [id]);
  },

  renumber(workoutExerciseId: number): void {
    const sets = queryAll(
      'SELECT id FROM cardio_sets WHERE workout_exercise_id = ? ORDER BY set_number, id',
      [workoutExerciseId],
    );
    sets.forEach((set, index) => {
      execSQL('UPDATE cardio_sets SET set_number = ? WHERE id = ?', [index + 1, set.id]);
    });
  },

  swapOrder(firstId: number, secondId: number): void {
    const first = this.get(firstId);
    const second = this.get(secondId);
    if (!first || !second || first.workout_exercise_id !== second.workout_exercise_id) return;
    const temporary = Math.max(...this.list(first.workout_exercise_id).map((set) => set.set_number)) + 1;
    execSQL('BEGIN');
    try {
      execSQL('UPDATE cardio_sets SET set_number = ? WHERE id = ?', [temporary, first.id]);
      execSQL('UPDATE cardio_sets SET set_number = ? WHERE id = ?', [first.set_number, second.id]);
      execSQL('UPDATE cardio_sets SET set_number = ? WHERE id = ?', [second.set_number, first.id]);
      execSQL('COMMIT');
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },
};
