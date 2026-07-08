import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const exerciseVariationsApi = {
  list(exerciseId) {
    return queryAll(
      'SELECT * FROM exercise_variations WHERE exercise_id = ? ORDER BY is_primary DESC, name',
      [exerciseId]
    );
  },
  get(id) {
    return queryOne('SELECT * FROM exercise_variations WHERE id = ?', [id]);
  },
  create({ exerciseId, name, isPrimary, tutorialUrl, notes }) {
    execSQL(
      'INSERT INTO exercise_variations (exercise_id, name, is_primary, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)',
      [exerciseId, name, isPrimary ? 1 : 0, tutorialUrl || null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id, { name, isPrimary, tutorialUrl, notes }) {
    execSQL(
      'UPDATE exercise_variations SET name = ?, is_primary = ?, tutorial_url = ?, notes = ? WHERE id = ?',
      [name, isPrimary ? 1 : 0, tutorialUrl || null, notes || null, id]
    );
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM exercise_variations WHERE id = ?', [id]);
  },
};
