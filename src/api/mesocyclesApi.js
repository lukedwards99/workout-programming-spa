import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const mesocyclesApi = {
  list() {
    return queryAll(
      `SELECT m.*, (SELECT COUNT(*) FROM workouts WHERE mesocycle_id = m.id) AS workout_count
       FROM mesocycles m ORDER BY m.sort_order, m.start_date`
    );
  },
  get(id) {
    return queryOne('SELECT * FROM mesocycles WHERE id = ?', [id]);
  },
  create({ name, microcycleLength, startDate, notes }) {
    execSQL(
      'INSERT INTO mesocycles (name, microcycle_length, start_date, notes) VALUES (?, ?, ?, ?)',
      [name, microcycleLength || 7, startDate, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id, { name, microcycleLength, startDate, notes }) {
    execSQL(
      'UPDATE mesocycles SET name = ?, microcycle_length = ?, start_date = ?, notes = ? WHERE id = ?',
      [name, microcycleLength, startDate, notes || null, id]
    );
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM mesocycles WHERE id = ?', [id]);
  },
};
