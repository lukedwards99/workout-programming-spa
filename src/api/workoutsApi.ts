import type {
  CardioSetWithNames,
  StrengthSetWithNames,
  Workout,
  WorkoutExerciseBlock,
} from '../types/domain';
import type { CreateWorkoutInput, UpdateWorkoutInput, CopyWorkoutInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

/**
 * Inserts a new workout and deep-copies its ordered exercise blocks and both
 * type-specific set tables. The caller owns the surrounding transaction.
 */
export function cloneWorkoutContents(
  source: Workout,
  name: string,
  dayOffset: number,
): number {
  execSQL(
    'INSERT INTO workouts (mesocycle_id, name, day_offset, notes, sort_order) VALUES (?, ?, ?, ?, ?)',
    [source.mesocycle_id, name, dayOffset, source.notes, source.sort_order],
  );
  const newWorkoutId = lastInsertRowId();

  const blocks = queryAll(
    `SELECT we.*, e.exercise_type
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ?
     ORDER BY we.exercise_order, we.id`,
    [source.id],
  );

  for (const block of blocks) {
    execSQL(
      `INSERT INTO workout_exercises
        (workout_id, exercise_id, exercise_variation_id, exercise_order)
       VALUES (?, ?, ?, ?)`,
      [
        newWorkoutId,
        block.exercise_id,
        block.exercise_variation_id,
        block.exercise_order,
      ],
    );
    const newBlockId = lastInsertRowId();

    if (block.exercise_type === 'cardio') {
      execSQL(
        `INSERT INTO cardio_sets
          (workout_exercise_id, set_number, planned_duration_seconds,
           actual_duration_seconds, planned_distance, actual_distance,
           distance_unit, target_rpe, actual_rpe, notes)
         SELECT ?, set_number, planned_duration_seconds, actual_duration_seconds,
                planned_distance, actual_distance, distance_unit, target_rpe,
                actual_rpe, notes
         FROM cardio_sets
         WHERE workout_exercise_id = ?`,
        [newBlockId, block.id],
      );
    } else {
      execSQL(
        `INSERT INTO strength_sets
          (workout_exercise_id, set_number, set_type, planned_reps,
           actual_reps, weight, rir, notes)
         SELECT ?, set_number, set_type, planned_reps, actual_reps, weight, rir, notes
         FROM strength_sets
         WHERE workout_exercise_id = ?`,
        [newBlockId, block.id],
      );
    }
  }

  return newWorkoutId;
}

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

function asStrengthSetWithNames(row: SqlRow): StrengthSetWithNames {
  return {
    id: row.id as number,
    workout_exercise_id: row.workout_exercise_id as number,
    set_number: row.set_number as number,
    set_type: row.set_type as StrengthSetWithNames['set_type'],
    planned_reps: row.planned_reps as number | null,
    actual_reps: row.actual_reps as number | null,
    weight: row.weight as number | null,
    rir: row.rir as number | null,
    notes: row.notes as string | null,
    exercise_name: row.exercise_name as string,
    variation_name: row.variation_name as string | null,
  };
}

function asCardioSetWithNames(row: SqlRow): CardioSetWithNames {
  return {
    id: row.id as number,
    workout_exercise_id: row.workout_exercise_id as number,
    set_number: row.set_number as number,
    planned_duration_seconds: row.planned_duration_seconds as number | null,
    actual_duration_seconds: row.actual_duration_seconds as number | null,
    planned_distance: row.planned_distance as number | null,
    actual_distance: row.actual_distance as number | null,
    distance_unit: row.distance_unit as CardioSetWithNames['distance_unit'],
    target_rpe: row.target_rpe as number | null,
    actual_rpe: row.actual_rpe as number | null,
    notes: row.notes as string | null,
    exercise_name: row.exercise_name as string,
    variation_name: row.variation_name as string | null,
  };
}

export const workoutsApi = {
  list(mesocycleId: number): Workout[] {
    return queryAll(
      'SELECT * FROM workouts WHERE mesocycle_id = ? ORDER BY day_offset, sort_order',
      [mesocycleId],
    ).map(asWorkout);
  },

  get(id: number): Workout | null {
    const row = queryOne('SELECT * FROM workouts WHERE id = ?', [id]);
    return row ? asWorkout(row) : null;
  },

  create({ mesocycleId, name, dayOffset, notes }: CreateWorkoutInput): Workout | null {
    execSQL(
      'INSERT INTO workouts (mesocycle_id, name, day_offset, notes) VALUES (?, ?, ?, ?)',
      [mesocycleId, name, dayOffset, notes || null],
    );
    return this.get(lastInsertRowId());
  },

  update(id: number, { name, dayOffset, notes }: UpdateWorkoutInput): Workout | null {
    execSQL(
      'UPDATE workouts SET name = ?, day_offset = ?, notes = ? WHERE id = ?',
      [name, dayOffset, notes || null, id],
    );
    return this.get(id);
  },

  delete(id: number): void {
    execSQL('DELETE FROM workouts WHERE id = ?', [id]);
  },

  copy(id: number, { name, dayOffset }: CopyWorkoutInput): Workout | null {
    const source = this.get(id);
    if (!source) return null;

    execSQL('BEGIN');
    try {
      const newId = cloneWorkoutContents(source, name, dayOffset);
      execSQL('COMMIT');
      return this.get(newId);
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },

  getExercisesWithSets(workoutId: number): WorkoutExerciseBlock[] {
    const blocks = queryAll(
      `SELECT
         we.id AS workout_exercise_id,
         e.id AS exercise_id,
         e.name AS exercise_name,
         e.notes AS exercise_notes,
         e.exercise_type,
         ev.id AS variation_id,
         ev.name AS variation_name,
         COALESCE(we.exercise_variation_id, 0) AS block_variation_id,
         we.exercise_order
       FROM workout_exercises we
       JOIN exercises e ON e.id = we.exercise_id
       LEFT JOIN exercise_variations ev ON ev.id = we.exercise_variation_id
       WHERE we.workout_id = ?
       ORDER BY we.exercise_order, we.id`,
      [workoutId],
    );

    return blocks.map((row): WorkoutExerciseBlock => {
      const base = {
        workout_exercise_id: row.workout_exercise_id as number,
        exercise_id: row.exercise_id as number,
        exercise_name: row.exercise_name as string,
        exercise_notes: row.exercise_notes as string | null,
        variation_id: row.variation_id as number | null,
        variation_name: row.variation_name as string | null,
        block_variation_id: row.block_variation_id as number,
        exercise_order: row.exercise_order as number,
        blockId: String(row.workout_exercise_id),
      };

      if (row.exercise_type === 'cardio') {
        const sets = queryAll(
          `SELECT cs.*, e.name AS exercise_name, ev.name AS variation_name
           FROM cardio_sets cs
           JOIN workout_exercises we ON we.id = cs.workout_exercise_id
           JOIN exercises e ON e.id = we.exercise_id
           LEFT JOIN exercise_variations ev ON ev.id = we.exercise_variation_id
           WHERE cs.workout_exercise_id = ?
           ORDER BY cs.set_number, cs.id`,
          [row.workout_exercise_id],
        ).map(asCardioSetWithNames);
        return { ...base, exercise_type: 'cardio', sets };
      }

      const sets = queryAll(
        `SELECT ss.*, e.name AS exercise_name, ev.name AS variation_name
         FROM strength_sets ss
         JOIN workout_exercises we ON we.id = ss.workout_exercise_id
         JOIN exercises e ON e.id = we.exercise_id
         LEFT JOIN exercise_variations ev ON ev.id = we.exercise_variation_id
         WHERE ss.workout_exercise_id = ?
         ORDER BY ss.set_number, ss.id`,
        [row.workout_exercise_id],
      ).map(asStrengthSetWithNames);
      return { ...base, exercise_type: 'strength', sets };
    });
  },
};
