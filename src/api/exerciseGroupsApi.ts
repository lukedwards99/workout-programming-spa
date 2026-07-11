import type { ExerciseGroup, ExerciseGroupWithCount } from '../types/domain';
import type { CreateExerciseGroupInput, UpdateExerciseGroupInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

function asExerciseGroup(row: SqlRow): ExerciseGroup {
  return {
    id: row.id as number,
    name: row.name as string,
    notes: row.notes as string | null,
  };
}

function asExerciseGroupWithCount(row: SqlRow): ExerciseGroupWithCount {
  return {
    ...asExerciseGroup(row),
    exercise_count: row.exercise_count as number,
  };
}

export const exerciseGroupsApi = {
  list(): ExerciseGroupWithCount[] {
    return queryAll(
      `SELECT eg.*, (SELECT COUNT(*) FROM exercises WHERE exercise_group_id = eg.id) AS exercise_count
       FROM exercise_groups eg ORDER BY eg.name`
    ).map(asExerciseGroupWithCount);
  },
  get(id: number): ExerciseGroup | null {
    const row = queryOne('SELECT * FROM exercise_groups WHERE id = ?', [id]);
    return row ? asExerciseGroup(row) : null;
  },
  create({ name, notes }: CreateExerciseGroupInput): ExerciseGroup | null {
    execSQL('INSERT INTO exercise_groups (name, notes) VALUES (?, ?)', [name, notes || null]);
    return this.get(lastInsertRowId());
  },
  update(id: number, { name, notes }: UpdateExerciseGroupInput): ExerciseGroup | null {
    execSQL('UPDATE exercise_groups SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM exercise_groups WHERE id = ?', [id]);
  },
  findOrCreate(name: string): ExerciseGroup {
    const existing = queryOne('SELECT * FROM exercise_groups WHERE name = ?', [name]);
    if (existing) return asExerciseGroup(existing);
    const result = this.create({ name, notes: '' });
    return result!;
  },
};
