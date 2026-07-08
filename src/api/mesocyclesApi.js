import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const mesocyclesApi = {
  list(programId) {
    return queryAll(
      `SELECT m.*, (SELECT COUNT(*) FROM workouts WHERE mesocycle_id = m.id) AS workout_count
       FROM mesocycles m WHERE m.program_id = ? ORDER BY m.sort_order, m.start_date`,
      [programId]
    );
  },
  get(id) {
    return queryOne('SELECT * FROM mesocycles WHERE id = ?', [id]);
  },
  create({ programId, name, microcycleLength, startDate, notes }) {
    execSQL(
      'INSERT INTO mesocycles (program_id, name, microcycle_length, start_date, notes) VALUES (?, ?, ?, ?, ?)',
      [programId, name, microcycleLength || 7, startDate, notes || null]
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
