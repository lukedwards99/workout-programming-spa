import type { Workout, WorkoutSetWithNames, WorkoutExerciseBlock } from '../types/domain';
import type { CreateWorkoutInput, UpdateWorkoutInput } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

function asWorkout(row: SqlRow): Workout {
  return {
    id: row.id as number,
    mesocycle_id: row.mesocycle_id as number,
    name: row.name as string,
    day_offset: row.day_offset as number,
    notes: row.notes as string | null,
    sort_order: row.sort_order as number,
  };
}

function asSetWithNames(row: SqlRow): WorkoutSetWithNames {
  return {
    id: row.id as number,
    workout_id: row.workout_id as number,
    exercise_id: row.exercise_id as number,
    exercise_variation_id: row.exercise_variation_id as number | null,
    exercise_order: row.exercise_order as number,
    set_number: row.set_number as number,
    set_type: row.set_type as WorkoutSetWithNames['set_type'],
    reps: row.reps as number | null,
    weight: row.weight as number | null,
    rir: row.rir as number | null,
    notes: row.notes as string | null,
    exercise_name: row.exercise_name as string,
    variation_name: row.variation_name as string | null,
  };
}

export const workoutsApi = {
  list(mesocycleId: number): Workout[] {
    return queryAll(
      'SELECT * FROM workouts WHERE mesocycle_id = ? ORDER BY day_offset, sort_order',
      [mesocycleId]
    ).map(asWorkout);
  },
  get(id: number): Workout | null {
    const row = queryOne('SELECT * FROM workouts WHERE id = ?', [id]);
    return row ? asWorkout(row) : null;
  },
  create({ mesocycleId, name, dayOffset, notes }: CreateWorkoutInput): Workout | null {
    execSQL(
      'INSERT INTO workouts (mesocycle_id, name, day_offset, notes) VALUES (?, ?, ?, ?)',
      [mesocycleId, name, dayOffset, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, { name, dayOffset, notes }: UpdateWorkoutInput): Workout | null {
    execSQL(
      'UPDATE workouts SET name = ?, day_offset = ?, notes = ? WHERE id = ?',
      [name, dayOffset, notes || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM workouts WHERE id = ?', [id]);
  },
  getExercisesWithSets(workoutId: number): WorkoutExerciseBlock[] {
    interface BlockRow extends SqlRow {
      exercise_id: number;
      exercise_name: string;
      exercise_notes: string | null;
      variation_id: number | null;
      variation_name: string | null;
      block_variation_id: number;
      exercise_order: number;
    }

    const rows: BlockRow[] = queryAll(
      `SELECT DISTINCT
         e.id AS exercise_id, e.name AS exercise_name, e.notes AS exercise_notes,
         ev.id AS variation_id, ev.name AS variation_name,
         COALESCE(ws.exercise_variation_id, 0) AS block_variation_id,
         ws.exercise_order
       FROM workout_sets ws
       JOIN exercises e ON ws.exercise_id = e.id
       LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
       WHERE ws.workout_id = ?
       ORDER BY ws.exercise_order`,
      [workoutId]
    ) as BlockRow[];

    return rows.map((row) => {
      const variationId = row.variation_id || null;
      const clause = variationId
        ? 'AND ws.exercise_variation_id = ?'
        : 'AND ws.exercise_variation_id IS NULL';
      const params: SqlValue[] = variationId
        ? [workoutId, row.exercise_id, variationId]
        : [workoutId, row.exercise_id];
      const sets = queryAll(
        `SELECT ws.*, e.name AS exercise_name,
                ev.name AS variation_name
         FROM workout_sets ws
         JOIN exercises e ON ws.exercise_id = e.id
         LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
         WHERE ws.workout_id = ? AND ws.exercise_id = ? ${clause}
         ORDER BY ws.set_number`,
        params
      ).map(asSetWithNames);
      return { ...row, blockId: `${row.exercise_id}-${row.block_variation_id}`, sets };
    });
  },
};
