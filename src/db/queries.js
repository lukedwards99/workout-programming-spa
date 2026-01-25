/**
 * SQL Queries module
 * Contains all SQL query strings used throughout the application
 */

export const queries = {
  // ===== DAYS =====
  getAllDays: 'SELECT * FROM days ORDER BY day_order',
  getDayById: 'SELECT * FROM days WHERE id = ?',
  getMaxDayOrder: 'SELECT MAX(day_order) as max_order FROM days',
  insertDay: 'INSERT INTO days (day_name, day_order) VALUES (?, ?)',
  deleteLastDay: 'DELETE FROM days WHERE day_order = (SELECT MAX(day_order) FROM days)',
  getDaysCount: 'SELECT COUNT(*) as count FROM days',

  // ===== WORKOUT GROUPS =====
  getAllWorkoutGroups: 'SELECT * FROM workout_groups ORDER BY name',
  getWorkoutGroupById: 'SELECT * FROM workout_groups WHERE id = ?',
  insertWorkoutGroup: 'INSERT INTO workout_groups (name, notes) VALUES (?, ?)',
  updateWorkoutGroup: 'UPDATE workout_groups SET name = ?, notes = ? WHERE id = ?',
  deleteWorkoutGroup: 'DELETE FROM workout_groups WHERE id = ?',

  // ===== EXERCISES =====
  getAllExercises: `
    SELECT e.*, wg.name as workout_group_name 
    FROM exercises e 
    JOIN workout_groups wg ON e.workout_group_id = wg.id 
    ORDER BY wg.name, e.name
  `,
  getExerciseById: `
    SELECT e.*, wg.name as workout_group_name 
    FROM exercises e 
    JOIN workout_groups wg ON e.workout_group_id = wg.id 
    WHERE e.id = ?
  `,
  getExercisesByWorkoutGroup: `
    SELECT e.*, wg.name as workout_group_name 
    FROM exercises e 
    JOIN workout_groups wg ON e.workout_group_id = wg.id 
    WHERE e.workout_group_id = ? 
    ORDER BY e.name
  `,
  getExercisesByWorkoutGroups: `
    SELECT e.*, wg.name as workout_group_name 
    FROM exercises e 
    JOIN workout_groups wg ON e.workout_group_id = wg.id 
    WHERE e.workout_group_id IN ({ids})
    ORDER BY wg.name, e.name
  `,
  insertExercise: 'INSERT INTO exercises (workout_group_id, name, notes) VALUES (?, ?, ?)',
  updateExercise: 'UPDATE exercises SET workout_group_id = ?, name = ?, notes = ? WHERE id = ?',
  deleteExercise: 'DELETE FROM exercises WHERE id = ?',

  // ===== DAY WORKOUT GROUPS =====
  getDayWorkoutGroups: `
    SELECT dwg.*, wg.name as workout_group_name, wg.notes as workout_group_notes
    FROM day_workout_groups dwg
    JOIN workout_groups wg ON dwg.workout_group_id = wg.id
    WHERE dwg.day_id = ?
    ORDER BY wg.name
  `,
  insertDayWorkoutGroup: 'INSERT INTO day_workout_groups (day_id, workout_group_id) VALUES (?, ?)',
  deleteDayWorkoutGroups: 'DELETE FROM day_workout_groups WHERE day_id = ?',
  deleteDayWorkoutGroup: 'DELETE FROM day_workout_groups WHERE day_id = ? AND workout_group_id = ?',

  // ===== SETS =====
  getAllSets: `
    SELECT s.*, d.day_name, e.name as exercise_name, e.notes as exercise_notes, 
           wg.name as workout_group_name
    FROM sets s
    JOIN days d ON s.day_id = d.id
    JOIN exercises e ON s.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    ORDER BY d.day_order, wg.name, e.name, s.set_order
  `,
  getSetsByDay: `
    SELECT s.*, e.name as exercise_name, e.notes as exercise_notes, 
           wg.name as workout_group_name
    FROM sets s
    JOIN exercises e ON s.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    WHERE s.day_id = ?
    ORDER BY wg.name, e.name, s.set_order
  `,
  getSetsByDayAndExercise: `
    SELECT s.*, e.name as exercise_name, e.notes as exercise_notes
    FROM sets s
    JOIN exercises e ON s.exercise_id = e.id
    WHERE s.day_id = ? AND s.exercise_id = ?
    ORDER BY s.set_order
  `,
  getSetById: 'SELECT * FROM sets WHERE id = ?',
  insertSet: 'INSERT INTO sets (day_id, exercise_id, set_order, reps, rir, notes) VALUES (?, ?, ?, ?, ?, ?)',
  updateSet: 'UPDATE sets SET set_order = ?, reps = ?, rir = ?, notes = ? WHERE id = ?',
  deleteSet: 'DELETE FROM sets WHERE id = ?',
  deleteSetsByDay: 'DELETE FROM sets WHERE day_id = ?',
  deleteSetsByDayAndExercise: 'DELETE FROM sets WHERE day_id = ? AND exercise_id = ?',
  getMaxSetOrder: 'SELECT MAX(set_order) as max_order FROM sets WHERE day_id = ? AND exercise_id = ?',

  // ===== EXPORT DATA (for CSV) =====
  getExportData: `
    SELECT 
      d.day_name,
      d.day_order,
      wg.name as workout_group_name,
      e.name as exercise_name,
      e.notes as exercise_notes,
      s.set_order,
      s.reps,
      s.rir,
      s.notes as set_notes
    FROM sets s
    JOIN days d ON s.day_id = d.id
    JOIN exercises e ON s.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    ORDER BY d.day_order, wg.name, e.name, s.set_order
  `
};
