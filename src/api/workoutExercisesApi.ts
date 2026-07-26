import type { WorkoutExercise } from '../types/domain';
import type { CreateWorkoutExerciseInput } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { execSQL, lastInsertRowId, queryAll, queryOne } from '../db/databaseService';

function asWorkoutExercise(row: SqlRow): WorkoutExercise {
  return {
    id: row.id as number,
    workout_id: row.workout_id as number,
    exercise_id: row.exercise_id as number,
    exercise_variation_id: row.exercise_variation_id as number | null,
    exercise_order: row.exercise_order as number,
  };
}

export const workoutExercisesApi = {
  list(workoutId: number): WorkoutExercise[] {
    return queryAll(
      'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY exercise_order, id',
      [workoutId],
    ).map(asWorkoutExercise);
  },

  get(id: number): WorkoutExercise | null {
    const row = queryOne('SELECT * FROM workout_exercises WHERE id = ?', [id]);
    return row ? asWorkoutExercise(row) : null;
  },

  create({
    workoutId,
    exerciseId,
    exerciseVariationId,
    exerciseOrder,
  }: CreateWorkoutExerciseInput): WorkoutExercise | null {
    const exercise = queryOne('SELECT exercise_type FROM exercises WHERE id = ?', [exerciseId]);
    if (!exercise) throw new Error('Exercise not found.');

    if (exerciseVariationId != null) {
      const variation = queryOne(
        'SELECT id FROM exercise_variations WHERE id = ? AND exercise_id = ?',
        [exerciseVariationId, exerciseId],
      );
      if (!variation) throw new Error('Exercise variation does not belong to the selected exercise.');
    }

    execSQL('BEGIN');
    try {
      execSQL(
        `INSERT INTO workout_exercises
          (workout_id, exercise_id, exercise_variation_id, exercise_order)
         VALUES (?, ?, ?, ?)`,
        [workoutId, exerciseId, (exerciseVariationId as SqlValue) ?? null, exerciseOrder],
      );
      const id = lastInsertRowId();
      if (exercise.exercise_type === 'cardio') {
        execSQL(
          'INSERT INTO cardio_sets (workout_exercise_id, set_number) VALUES (?, 1)',
          [id],
        );
      } else {
        execSQL(
          `INSERT INTO strength_sets
            (workout_exercise_id, set_number, set_type)
           VALUES (?, 1, 'normal')`,
          [id],
        );
      }
      execSQL('COMMIT');
      return this.get(id);
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },

  delete(id: number): void {
    execSQL('DELETE FROM workout_exercises WHERE id = ?', [id]);
  },

  getMaxExerciseOrder(workoutId: number): number {
    return Number(queryOne(
      'SELECT COALESCE(MAX(exercise_order), 0) AS max_order FROM workout_exercises WHERE workout_id = ?',
      [workoutId],
    )?.max_order ?? 0);
  },

  swapOrder(firstId: number, secondId: number): void {
    const first = this.get(firstId);
    const second = this.get(secondId);
    if (!first || !second || first.workout_id !== second.workout_id) {
      throw new Error('Workout exercise blocks could not be reordered.');
    }
    const temporaryOrder = this.getMaxExerciseOrder(first.workout_id) + 1;
    execSQL('BEGIN');
    try {
      execSQL('UPDATE workout_exercises SET exercise_order = ? WHERE id = ?', [temporaryOrder, first.id]);
      execSQL('UPDATE workout_exercises SET exercise_order = ? WHERE id = ?', [first.exercise_order, second.id]);
      execSQL('UPDATE workout_exercises SET exercise_order = ? WHERE id = ?', [second.exercise_order, first.id]);
      execSQL('COMMIT');
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },

  isExerciseProgrammed(exerciseId: number): boolean {
    return queryOne(
      'SELECT id FROM workout_exercises WHERE exercise_id = ? LIMIT 1',
      [exerciseId],
    ) !== null;
  },
};
