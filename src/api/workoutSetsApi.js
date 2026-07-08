import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const workoutSetsApi = {
  list(workoutId, exerciseId) {
    return queryAll(
      `SELECT ws.*, e.name AS exercise_name, ev.name AS variation_name
       FROM workout_sets ws
       JOIN exercises e ON ws.exercise_id = e.id
       LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
       WHERE ws.workout_id = ? AND ws.exercise_id = ?
       ORDER BY ws.set_number`,
      [workoutId, exerciseId]
    );
  },
  get(id) {
    return queryOne('SELECT * FROM workout_sets WHERE id = ?', [id]);
  },
  create({ workoutId, exerciseId, exerciseVariationId, exerciseOrder, setNumber, setType, reps, weight, rir, notes }) {
    execSQL(
      `INSERT INTO workout_sets (workout_id, exercise_id, exercise_variation_id, exercise_order, set_number, set_type, reps, weight, rir, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [workoutId, exerciseId, exerciseVariationId ?? null, exerciseOrder, setNumber, setType || 'normal', reps ?? null, weight ?? null, rir ?? null, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id, changes) {
    const existing = queryOne('SELECT * FROM workout_sets WHERE id = ?', [id]);
    if (!existing) return null;
    const row = { ...existing, ...changes };
    execSQL(
      'UPDATE workout_sets SET set_number = ?, set_type = ?, reps = ?, weight = ?, rir = ?, notes = ? WHERE id = ?',
      [row.set_number, row.set_type, row.reps ?? null, row.weight ?? null, row.rir ?? null, row.notes || null, id]
    );
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM workout_sets WHERE id = ?', [id]);
  },
  deleteByExercise(workoutId, exerciseId, exerciseVariationId = null) {
    if (exerciseVariationId) {
      execSQL(
        'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND exercise_variation_id = ?',
        [workoutId, exerciseId, exerciseVariationId]
      );
    } else {
      execSQL(
        'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND exercise_variation_id IS NULL',
        [workoutId, exerciseId]
      );
    }
  },
  // Renumber sets for an exercise
  renumber(workoutId, exerciseId) {
    const sets = queryAll(
      'SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number',
      [workoutId, exerciseId]
    );
    sets.forEach((s, i) => {
      execSQL('UPDATE workout_sets SET set_number = ? WHERE id = ?', [i + 1, s.id]);
    });
  },
  // Get max exercise_order for a workout
  getMaxExerciseOrder(workoutId) {
    return queryAll(
      'SELECT COALESCE(MAX(exercise_order), 0) AS max_order FROM workout_sets WHERE workout_id = ?',
      [workoutId]
    )[0]?.max_order || 0;
  },
};
