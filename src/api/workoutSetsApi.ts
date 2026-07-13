import type { WorkoutSet, WorkoutSetWithNames } from '../types/domain';
import type { CreateWorkoutSetInput, UpdateWorkoutSetInput } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

function asWorkoutSet(row: SqlRow): WorkoutSet {
  return {
    id: row.id as number,
    workout_id: row.workout_id as number,
    exercise_id: row.exercise_id as number,
    exercise_variation_id: row.exercise_variation_id as number | null,
    exercise_order: row.exercise_order as number,
    set_number: row.set_number as number,
    set_type: row.set_type as WorkoutSet['set_type'],
    planned_reps: row.planned_reps as number | null,
    actual_reps: row.actual_reps as number | null,
    weight: row.weight as number | null,
    rir: row.rir as number | null,
    notes: row.notes as string | null,
  };
}

function asSetWithNames(row: SqlRow): WorkoutSetWithNames {
  return {
    ...asWorkoutSet(row),
    exercise_name: row.exercise_name as string,
    variation_name: row.variation_name as string | null,
  };
}

export const workoutSetsApi = {
  list(workoutId: number, exerciseId: number): WorkoutSetWithNames[] {
    return queryAll(
      `SELECT ws.*, e.name AS exercise_name, ev.name AS variation_name
       FROM workout_sets ws
       JOIN exercises e ON ws.exercise_id = e.id
       LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
       WHERE ws.workout_id = ? AND ws.exercise_id = ?
       ORDER BY ws.set_number`,
      [workoutId, exerciseId]
    ).map(asSetWithNames);
  },
  get(id: number): WorkoutSet | null {
    const row = queryOne('SELECT * FROM workout_sets WHERE id = ?', [id]);
    return row ? asWorkoutSet(row) : null;
  },
  create({ workoutId, exerciseId, exerciseVariationId, exerciseOrder, setNumber, setType, plannedReps, actualReps, weight, rir, notes }: CreateWorkoutSetInput): WorkoutSet | null {
    execSQL(
      `INSERT INTO workout_sets (workout_id, exercise_id, exercise_variation_id, exercise_order, set_number, set_type, planned_reps, actual_reps, weight, rir, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [workoutId, exerciseId, (exerciseVariationId as SqlValue) ?? null, exerciseOrder, setNumber, setType || 'normal', (plannedReps as SqlValue) ?? null, (actualReps as SqlValue) ?? null, (weight as SqlValue) ?? null, (rir as SqlValue) ?? null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, changes: UpdateWorkoutSetInput): WorkoutSet | null {
    const existing = queryOne('SELECT * FROM workout_sets WHERE id = ?', [id]);
    if (!existing) return null;
    const setNumber = changes.set_number ?? existing.set_number as number;
    const setType = changes.set_type ?? existing.set_type as WorkoutSet['set_type'];
    const plannedReps = changes.planned_reps !== undefined ? changes.planned_reps : existing.planned_reps as number | null;
    const actualReps = changes.actual_reps !== undefined ? changes.actual_reps : existing.actual_reps as number | null;
    const weightVal = changes.weight !== undefined ? changes.weight : existing.weight as number | null;
    const rirVal = changes.rir !== undefined ? changes.rir : existing.rir as number | null;
    const notesVal = changes.notes !== undefined ? changes.notes : existing.notes as string | null;
    execSQL(
      'UPDATE workout_sets SET set_number = ?, set_type = ?, planned_reps = ?, actual_reps = ?, weight = ?, rir = ?, notes = ? WHERE id = ?',
      [setNumber, setType, plannedReps ?? null, actualReps ?? null, weightVal ?? null, rirVal ?? null, notesVal || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM workout_sets WHERE id = ?', [id]);
  },
  deleteByExercise(workoutId: number, exerciseId: number, exerciseVariationId: number | null = null): void {
    if (exerciseVariationId) {
      execSQL(
        'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND exercise_variation_id = ?',
        [workoutId, exerciseId, exerciseVariationId]
      );
    } else {
      execSQL(
        'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND exercise_variation_id IS NULL',
        [workoutId, exerciseId]
      );
    }
  },
  renumber(workoutId: number, exerciseId: number, exerciseVariationId: number | null = null): void {
    const clause = exerciseVariationId
      ? 'AND exercise_variation_id = ?'
      : 'AND exercise_variation_id IS NULL';
    const params: SqlValue[] = exerciseVariationId
      ? [workoutId, exerciseId, exerciseVariationId]
      : [workoutId, exerciseId];
    const sets = queryAll(
      `SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ${clause} ORDER BY set_number`,
      params
    );
    sets.forEach((s, i) => {
      execSQL('UPDATE workout_sets SET set_number = ? WHERE id = ?', [i + 1, s.id]);
    });
  },
  getMaxExerciseOrder(workoutId: number): number {
    return queryAll(
      'SELECT COALESCE(MAX(exercise_order), 0) AS max_order FROM workout_sets WHERE workout_id = ?',
      [workoutId]
    )[0]?.max_order as number || 0;
  },
  swapExerciseOrder(
    workoutId: number,
    first: { exerciseId: number; exerciseVariationId: number | null; exerciseOrder: number },
    second: { exerciseId: number; exerciseVariationId: number | null; exerciseOrder: number }
  ): void {
    const updateOrder = (exerciseId: number, variationId: number | null, order: number) => {
      const clause = variationId === null
        ? 'exercise_variation_id IS NULL'
        : 'exercise_variation_id = ?';
      const params: SqlValue[] = variationId === null
        ? [order, workoutId, exerciseId]
        : [order, workoutId, exerciseId, variationId];
      execSQL(
        `UPDATE workout_sets SET exercise_order = ?
         WHERE workout_id = ? AND exercise_id = ? AND ${clause}`,
        params
      );
    };

    const temporaryOrder = this.getMaxExerciseOrder(workoutId) + 1;
    execSQL('BEGIN');
    try {
      updateOrder(first.exerciseId, first.exerciseVariationId, temporaryOrder);
      updateOrder(second.exerciseId, second.exerciseVariationId, first.exerciseOrder);
      updateOrder(first.exerciseId, first.exerciseVariationId, second.exerciseOrder);
      execSQL('COMMIT');
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },
};
