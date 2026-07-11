import type { ExerciseVariation } from '../types/domain';
import type { CreateExerciseVariationInput, UpdateExerciseVariationInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

function asExerciseVariation(row: SqlRow): ExerciseVariation {
  return {
    id: row.id as number,
    exercise_id: row.exercise_id as number,
    name: row.name as string,
    is_primary: row.is_primary as number,
    tutorial_url: row.tutorial_url as string | null,
    notes: row.notes as string | null,
  };
}

export const exerciseVariationsApi = {
  list(exerciseId: number): ExerciseVariation[] {
    return queryAll(
      'SELECT * FROM exercise_variations WHERE exercise_id = ? ORDER BY is_primary DESC, name',
      [exerciseId]
    ).map(asExerciseVariation);
  },
  get(id: number): ExerciseVariation | null {
    const row = queryOne('SELECT * FROM exercise_variations WHERE id = ?', [id]);
    return row ? asExerciseVariation(row) : null;
  },
  create({ exerciseId, name, isPrimary, tutorialUrl, notes }: CreateExerciseVariationInput): ExerciseVariation | null {
    if (isPrimary) {
      execSQL('UPDATE exercise_variations SET is_primary = 0 WHERE exercise_id = ?', [exerciseId]);
    }
    execSQL(
      'INSERT INTO exercise_variations (exercise_id, name, is_primary, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)',
      [exerciseId, name, isPrimary ? 1 : 0, tutorialUrl || null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, { name, isPrimary, tutorialUrl, notes }: UpdateExerciseVariationInput): ExerciseVariation | null {
    if (isPrimary) {
      const v = this.get(id);
      if (v) execSQL('UPDATE exercise_variations SET is_primary = 0 WHERE exercise_id = ?', [v.exercise_id]);
    }
    execSQL(
      'UPDATE exercise_variations SET name = ?, is_primary = ?, tutorial_url = ?, notes = ? WHERE id = ?',
      [name, isPrimary ? 1 : 0, tutorialUrl || null, notes || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM exercise_variations WHERE id = ?', [id]);
  },
};
