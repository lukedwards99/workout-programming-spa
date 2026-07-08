import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';
import { exerciseVariationsApi } from './exerciseVariationsApi';

export const exercisesApi = {
  list(groupId) {
    let sql = 'SELECT * FROM exercises';
    const params = [];
    if (groupId != null) {
      sql += ' WHERE exercise_group_id = ?';
      params.push(groupId);
    }
    sql += ' ORDER BY name';
    return queryAll(sql, params);
  },
  get(id) {
    return queryOne('SELECT * FROM exercises WHERE id = ?', [id]);
  },
  getWithVariations(id) {
    const exercise = this.get(id);
    if (!exercise) return null;
    exercise.variations = exerciseVariationsApi.list(id);
    return exercise;
  },
  create({ groupId, name, tutorialUrl, notes }) {
    execSQL(
      'INSERT INTO exercises (exercise_group_id, name, tutorial_url, notes) VALUES (?, ?, ?, ?)',
      [groupId, name, tutorialUrl || null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id, { groupId, name, tutorialUrl, notes }) {
    execSQL(
      'UPDATE exercises SET exercise_group_id = ?, name = ?, tutorial_url = ?, notes = ? WHERE id = ?',
      [groupId, name, tutorialUrl || null, notes || null, id]
    );
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM exercises WHERE id = ?', [id]);
  },
  search(query) {
    return queryAll(
      'SELECT * FROM exercises WHERE name LIKE ? ORDER BY name',
      [`%${query}%`]
    );
  },
};
