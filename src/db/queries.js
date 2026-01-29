/**
 * SQL Queries module
 * Contains all SQL query strings used throughout the application
 * 
 * New schema uses workout_sets table (combines day_exercises + sets)
 */

export const queries = {
  // ===== DAYS =====
  getAllDays: 'SELECT * FROM days ORDER BY day_order',
  getDayById: 'SELECT * FROM days WHERE id = ?',
  getMaxDayOrder: 'SELECT MAX(day_order) as max_order FROM days',
  insertDay: 'INSERT INTO days (day_name, day_order) VALUES (?, ?)',
  deleteLastDay: 'DELETE FROM days WHERE day_order = (SELECT MAX(day_order) FROM days)',
  deleteDay: 'DELETE FROM days WHERE id = ?',
  updateDayOrder: 'UPDATE days SET day_order = ? WHERE id = ?',
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

  // ===== WORKOUT SETS (replaces day_exercises + sets) =====
  
  // Get all workout sets with full details
  getAllWorkoutSets: `
    SELECT ws.*, d.day_name, d.day_order,
           e.name as exercise_name, e.notes as exercise_notes, 
           wg.name as workout_group_name
    FROM workout_sets ws
    JOIN days d ON ws.day_id = d.id
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    ORDER BY d.day_order, ws.exercise_order, ws.set_order
  `,
  
  // Get all workout sets for a specific day
  getWorkoutSetsByDay: `
    SELECT ws.*,
           e.id as exercise_id, e.name as exercise_name, e.notes as exercise_notes, 
           wg.name as workout_group_name, wg.id as workout_group_id
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    WHERE ws.day_id = ?
    ORDER BY ws.exercise_order, ws.set_order
  `,
  
  // Get all sets for a specific exercise on a specific day
  getWorkoutSetsByDayAndExercise: `
    SELECT ws.*, e.name as exercise_name, e.notes as exercise_notes
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    WHERE ws.day_id = ? AND ws.exercise_id = ?
    ORDER BY ws.set_order
  `,
  
  // Get a single workout set by ID
  getWorkoutSetById: `
    SELECT ws.*, e.name as exercise_name, e.notes as exercise_notes,
           wg.name as workout_group_name
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    WHERE ws.id = ?
  `,
  
  // Get distinct exercises used on a day (with their order)
  getExercisesByDay: `
    SELECT DISTINCT ws.exercise_id, ws.exercise_order,
           e.name as exercise_name, e.notes as exercise_notes,
           wg.name as workout_group_name, wg.id as workout_group_id
    FROM workout_sets ws
    JOIN exercises e ON ws.exercise_id = e.id
    JOIN workout_groups wg ON e.workout_group_id = wg.id
    WHERE ws.day_id = ?
    ORDER BY ws.exercise_order
  `,
  
  // Insert a new workout set
  insertWorkoutSet: `
    INSERT INTO workout_sets (day_id, exercise_id, exercise_order, set_order, reps, weight, rir, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  // Update a workout set
  updateWorkoutSet: `
    UPDATE workout_sets 
    SET exercise_order = ?, set_order = ?, reps = ?, weight = ?, rir = ?, notes = ? 
    WHERE id = ?
  `,
  
  // Delete a workout set
  deleteWorkoutSet: 'DELETE FROM workout_sets WHERE id = ?',
  
  // Delete all sets for a specific exercise on a day
  deleteWorkoutSetsByDayAndExercise: 'DELETE FROM workout_sets WHERE day_id = ? AND exercise_id = ?',
  
  // Delete all sets for a day
  deleteWorkoutSetsByDay: 'DELETE FROM workout_sets WHERE day_id = ?',
  
  // Get max exercise order for a day
  getMaxExerciseOrder: 'SELECT MAX(exercise_order) as max_order FROM workout_sets WHERE day_id = ?',
  
  // Get max set order for a day/exercise combination
  getMaxSetOrder: 'SELECT MAX(set_order) as max_order FROM workout_sets WHERE day_id = ? AND exercise_id = ?',
  
  // Get count of sets for a day/exercise combination
  getSetCount: 'SELECT COUNT(*) as count FROM workout_sets WHERE day_id = ? AND exercise_id = ?'
};
