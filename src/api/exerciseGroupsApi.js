import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const exerciseGroupsApi = {
  list() {
    return queryAll(
      `SELECT eg.*, (SELECT COUNT(*) FROM exercises WHERE exercise_group_id = eg.id) AS exercise_count
       FROM exercise_groups eg ORDER BY eg.name`
    );
  },
  get(id) {
    return queryOne('SELECT * FROM exercise_groups WHERE id = ?', [id]);
  },
  create({ name, notes }) {
    execSQL('INSERT INTO exercise_groups (name, notes) VALUES (?, ?)', [name, notes || null]);
    return this.get(lastInsertRowId());
  },
  update(id, { name, notes }) {
    execSQL('UPDATE exercise_groups SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM exercise_groups WHERE id = ?', [id]);
  },
  findOrCreate(name) {
    const existing = queryOne('SELECT * FROM exercise_groups WHERE name = ?', [name]);
    if (existing) return existing;
    return this.create({ name, notes: null });
  },
};
