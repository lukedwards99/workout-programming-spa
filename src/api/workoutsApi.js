import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

export const workoutsApi = {
  list(mesocycleId) {
    return queryAll(
      'SELECT * FROM workouts WHERE mesocycle_id = ? ORDER BY day_offset, sort_order',
      [mesocycleId]
    );
  },
  get(id) {
    return queryOne('SELECT * FROM workouts WHERE id = ?', [id]);
  },
  create({ mesocycleId, name, dayOffset, notes }) {
    execSQL(
      'INSERT INTO workouts (mesocycle_id, name, day_offset, notes) VALUES (?, ?, ?, ?)',
      [mesocycleId, name, dayOffset, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id, { name, dayOffset, notes }) {
    execSQL(
      'UPDATE workouts SET name = ?, day_offset = ?, notes = ? WHERE id = ?',
      [name, dayOffset, notes || null, id]
    );
    return this.get(id);
  },
  delete(id) {
    execSQL('DELETE FROM workouts WHERE id = ?', [id]);
  },
  // Get exercises with their sets for a workout
  getExercisesWithSets(workoutId) {
    const rows = queryAll(
      `SELECT DISTINCT
         e.id AS exercise_id, e.name AS exercise_name, e.notes AS exercise_notes,
         ev.id AS variation_id, ev.name AS variation_name,
         ws.exercise_order
       FROM workout_sets ws
       JOIN exercises e ON ws.exercise_id = e.id
       LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
       WHERE ws.workout_id = ?
       ORDER BY ws.exercise_order`,
      [workoutId]
    );

    return rows.map((row) => {
      const sets = queryAll(
        `SELECT ws.*, e.name AS exercise_name,
                ev.name AS variation_name
         FROM workout_sets ws
         JOIN exercises e ON ws.exercise_id = e.id
         LEFT JOIN exercise_variations ev ON ws.exercise_variation_id = ev.id
         WHERE ws.workout_id = ? AND ws.exercise_id = ?
         ORDER BY ws.set_number`,
        [workoutId, row.exercise_id]
      );
      return { ...row, sets };
    });
  },
};
