import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const programsApi = {
  list() {
    return queryAll(`SELECT p.*, (SELECT COUNT(*) FROM mesocycles WHERE program_id = p.id) AS meso_count FROM programs p ORDER BY p.created_at DESC`);
  },
  get(id) {
    return queryOne('SELECT * FROM programs WHERE id = ?', [id]);
  },
  create({ name, notes }) {
    execSQL('INSERT INTO programs (name, notes) VALUES (?, ?)', [name, notes || null]);
    return this.get(lastInsertRowId());
  },
  update(id, { name, notes }) {
    execSQL('UPDATE programs SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM programs WHERE id = ?', [id]);
  },
};
