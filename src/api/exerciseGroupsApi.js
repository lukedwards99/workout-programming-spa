import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const exerciseGroupsApi = {
  list(programId) {
    return queryAll(
      `SELECT eg.*, (SELECT COUNT(*) FROM exercises WHERE exercise_group_id = eg.id) AS exercise_count
       FROM exercise_groups eg WHERE eg.program_id = ? ORDER BY eg.name`,
      [programId]
    );
  },
  get(id) {
    return queryOne('SELECT * FROM exercise_groups WHERE id = ?', [id]);
  },
  create({ programId, name, notes }) {
    execSQL('INSERT INTO exercise_groups (program_id, name, notes) VALUES (?, ?, ?)', [programId, name, notes || null]);
    return this.get(lastInsertRowId());
  },
  update(id, { name, notes }) {
    execSQL('UPDATE exercise_groups SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM exercise_groups WHERE id = ?', [id]);
  },
  findOrCreate(programId, name) {
    const existing = queryOne('SELECT * FROM exercise_groups WHERE program_id = ? AND name = ?', [programId, name]);
    if (existing) return existing;
    return this.create({ programId, name, notes: null });
  },
};
