import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';
import { exerciseVariationsApi } from './exerciseVariationsApi';

export const exercisesApi = {
  list(programId, groupId) {
    let sql = `SELECT e.* FROM exercises e
               JOIN exercise_groups eg ON e.exercise_group_id = eg.id
               WHERE eg.program_id = ?`;
    const params = [programId];
    if (groupId != null) {
      sql += ' AND e.exercise_group_id = ?';
      params.push(groupId);
    }
    sql += ' ORDER BY e.name';
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
  search(programId, query) {
    return queryAll(
      `SELECT e.* FROM exercises e
       JOIN exercise_groups eg ON e.exercise_group_id = eg.id
       WHERE eg.program_id = ? AND e.name LIKE ? ORDER BY e.name`,
      [programId, `%${query}%`]
    );
  },
};
