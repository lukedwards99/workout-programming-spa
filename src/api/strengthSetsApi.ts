import type { StrengthSet } from '../types/domain';
import type { CreateStrengthSetInput, UpdateStrengthSetInput } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { execSQL, lastInsertRowId, queryAll, queryOne } from '../db/databaseService';

function asStrengthSet(row: SqlRow): StrengthSet {
  return {
    id: row.id as number,
    workout_exercise_id: row.workout_exercise_id as number,
    set_number: row.set_number as number,
    set_type: row.set_type as StrengthSet['set_type'],
    planned_reps: row.planned_reps as number | null,
    actual_reps: row.actual_reps as number | null,
    weight: row.weight as number | null,
    rir: row.rir as number | null,
    notes: row.notes as string | null,
  };
}

function assertStrengthBlock(workoutExerciseId: number): void {
  const row = queryOne(
    `SELECT e.exercise_type
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.id = ?`,
    [workoutExerciseId],
  );
  if (!row) throw new Error('Workout exercise block not found.');
  if (row.exercise_type !== 'strength') throw new Error('Strength sets require a strength exercise.');
}

export const strengthSetsApi = {
  list(workoutExerciseId: number): StrengthSet[] {
    return queryAll(
      'SELECT * FROM strength_sets WHERE workout_exercise_id = ? ORDER BY set_number, id',
      [workoutExerciseId],
    ).map(asStrengthSet);
  },

  get(id: number): StrengthSet | null {
    const row = queryOne('SELECT * FROM strength_sets WHERE id = ?', [id]);
    return row ? asStrengthSet(row) : null;
  },

  create({
    workoutExerciseId,
    setNumber,
    setType,
    plannedReps,
    actualReps,
    weight,
    rir,
    notes,
  }: CreateStrengthSetInput): StrengthSet | null {
    assertStrengthBlock(workoutExerciseId);
    execSQL(
      `INSERT INTO strength_sets
        (workout_exercise_id, set_number, set_type, planned_reps, actual_reps, weight, rir, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workoutExerciseId,
        setNumber,
        setType || 'normal',
        (plannedReps as SqlValue) ?? null,
        (actualReps as SqlValue) ?? null,
        (weight as SqlValue) ?? null,
        (rir as SqlValue) ?? null,
        notes || null,
      ],
    );
    return this.get(lastInsertRowId());
  },

  update(id: number, changes: UpdateStrengthSetInput): StrengthSet | null {
    const existing = this.get(id);
    if (!existing) return null;
    execSQL(
      `UPDATE strength_sets
       SET set_number = ?, set_type = ?, planned_reps = ?, actual_reps = ?,
           weight = ?, rir = ?, notes = ?
       WHERE id = ?`,
      [
        changes.set_number ?? existing.set_number,
        changes.set_type ?? existing.set_type,
        changes.planned_reps !== undefined ? changes.planned_reps : existing.planned_reps,
        changes.actual_reps !== undefined ? changes.actual_reps : existing.actual_reps,
        changes.weight !== undefined ? changes.weight : existing.weight,
        changes.rir !== undefined ? changes.rir : existing.rir,
        changes.notes !== undefined ? changes.notes || null : existing.notes,
        id,
      ],
    );
    return this.get(id);
  },

  delete(id: number): void {
    execSQL('DELETE FROM strength_sets WHERE id = ?', [id]);
  },

  renumber(workoutExerciseId: number): void {
    const sets = queryAll(
      'SELECT id FROM strength_sets WHERE workout_exercise_id = ? ORDER BY set_number, id',
      [workoutExerciseId],
    );
    sets.forEach((set, index) => {
      execSQL('UPDATE strength_sets SET set_number = ? WHERE id = ?', [index + 1, set.id]);
    });
  },

  swapOrder(firstId: number, secondId: number): void {
    const first = this.get(firstId);
    const second = this.get(secondId);
    if (!first || !second || first.workout_exercise_id !== second.workout_exercise_id) return;
    const temporary = Math.max(...this.list(first.workout_exercise_id).map((set) => set.set_number)) + 1;
    execSQL('BEGIN');
    try {
      execSQL('UPDATE strength_sets SET set_number = ? WHERE id = ?', [temporary, first.id]);
      execSQL('UPDATE strength_sets SET set_number = ? WHERE id = ?', [first.set_number, second.id]);
      execSQL('UPDATE strength_sets SET set_number = ? WHERE id = ?', [second.set_number, first.id]);
      execSQL('COMMIT');
    } catch (error) {
      execSQL('ROLLBACK');
      throw error;
    }
  },
};
