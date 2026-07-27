import type { Exercise, ExerciseType, ExerciseWithVariations } from '../types/domain';
import type { CreateExerciseInput, UpdateExerciseInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';
import { exerciseVariationsApi } from './exerciseVariationsApi';

function asExercise(row: SqlRow): Exercise {
  return {
    id: row.id as number,
    exercise_group_id: row.exercise_group_id as number,
    name: row.name as string,
    exercise_type: row.exercise_type as ExerciseType,
    tutorial_url: row.tutorial_url as string | null,
    notes: row.notes as string | null,
  };
}

export const exercisesApi = {
  list(groupId: number | null, exerciseType: ExerciseType | null = null): Exercise[] {
    let sql = `SELECT e.* FROM exercises e`;
    const params: import('../types/database').SqlValue[] = [];
    const clauses: string[] = [];
    if (groupId != null) {
      clauses.push('e.exercise_group_id = ?');
      params.push(groupId);
    }
    if (exerciseType != null) {
      clauses.push('e.exercise_type = ?');
      params.push(exerciseType);
    }
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    sql += ' ORDER BY e.name';
    return queryAll(sql, params).map(asExercise);
  },
  get(id: number): Exercise | null {
    const row = queryOne('SELECT * FROM exercises WHERE id = ?', [id]);
    return row ? asExercise(row) : null;
  },
  getWithVariations(id: number): ExerciseWithVariations | null {
    const exercise = this.get(id);
    if (!exercise) return null;
    const result = exercise as ExerciseWithVariations;
    result.variations = exerciseVariationsApi.list(id);
    return result;
  },
  create({ groupId, name, exerciseType, tutorialUrl, notes }: CreateExerciseInput): Exercise | null {
    execSQL(
      'INSERT INTO exercises (exercise_group_id, name, exercise_type, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)',
      [groupId, name, exerciseType || 'strength', tutorialUrl || null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, { groupId, name, exerciseType, tutorialUrl, notes }: UpdateExerciseInput): Exercise | null {
    execSQL(
      'UPDATE exercises SET exercise_group_id = ?, name = ?, exercise_type = ?, tutorial_url = ?, notes = ? WHERE id = ?',
      [groupId, name, exerciseType, tutorialUrl || null, notes || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM exercises WHERE id = ?', [id]);
  },
  search(query: string): Exercise[] {
    return queryAll(
      `SELECT e.* FROM exercises e
       WHERE e.name LIKE ? ORDER BY e.name`,
      [`%${query}%`]
    ).map(asExercise);
  },
};
