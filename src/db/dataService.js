import { getDatabase, saveDatabaseToIndexedDB, resetDatabase, initDatabase, seedInitialData } from './database.js';
import { queries } from './queries.js';
import Papa from 'papaparse';

/**
 * Data Service
 * Handles all CRUD operations and data transformations
 * Auto-saves to IndexedDB after every modification
 * 
 * New simplified schema:
 * - workout_sets table combines day_exercises + sets
 * - Enforces: every exercise must have at least one set
 */

// ===== HELPER FUNCTIONS =====

/**
 * Execute a query and return all results
 */
function executeQuery(query, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(query);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  return results;
}

/**
 * Execute a query and return first result
 */
function executeQueryOne(query, params = []) {
  const results = executeQuery(query, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute an insert/update/delete query
 */
async function executeUpdate(query, params = []) {
  const db = getDatabase();
  db.run(query, params);
  await saveDatabaseToIndexedDB();
}

/**
 * Execute an insert query and return the last insert ID
 */
async function executeInsert(query, params = []) {
  const db = getDatabase();
  db.run(query, params);
  const result = executeQueryOne('SELECT last_insert_rowid() as id');
  const id = result ? result.id : null;
  await saveDatabaseToIndexedDB();
  return id;
}

/**
 * Get last insert ID
 */
function getLastInsertId() {
  const db = getDatabase();
  const result = executeQueryOne('SELECT last_insert_rowid() as id');
  return result ? result.id : null;
}

// ===== DAYS =====

export function getAllDays() {
  return executeQuery(queries.getAllDays);
}

export function getDayById(id) {
  return executeQueryOne(queries.getDayById, [id]);
}

export function getDaysCount() {
  const result = executeQueryOne(queries.getDaysCount);
  return result ? result.count : 0;
}

export async function addDay(dayName, id = null, notes = '') {
  // Get next day order
  const result = executeQueryOne(queries.getMaxDayOrder);
  const nextOrder = (result && result.max_order ? result.max_order : 0) + 1;
  
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO days (id, day_name, day_order, notes) VALUES (?, ?, ?, ?)', [id, dayName, nextOrder, notes]);
  }
  
  return await executeInsert('INSERT INTO days (day_name, day_order, notes) VALUES (?, ?, ?)', [dayName, nextOrder, notes]);
}

export async function insertDayAfter(dayName, afterDayId, notes = '') {
  // Get the day_order of the day we're inserting after
  const afterDay = getDayById(afterDayId);
  if (!afterDay) {
    throw new Error('Day not found');
  }
  
  const insertOrder = afterDay.day_order + 1;
  
  // Shift all days after this position up by 1
  const daysToShift = executeQuery('SELECT * FROM days WHERE day_order >= ? ORDER BY day_order DESC', [insertOrder]);
  for (const day of daysToShift) {
    await executeUpdate(queries.updateDayOrder, [day.day_order + 1, day.id]);
  }
  
  // Insert the new day
  return await executeInsert('INSERT INTO days (day_name, day_order, notes) VALUES (?, ?, ?)', [dayName, insertOrder, notes]);
}

export async function removeLastDay() {
  const count = getDaysCount();
  if (count === 0) {
    throw new Error('No days to remove');
  }
  
  await executeUpdate(queries.deleteLastDay);
}

export async function deleteDay(dayId) {
  const day = getDayById(dayId);
  if (!day) {
    throw new Error('Day not found');
  }
  
  // Delete the day
  await executeUpdate(queries.deleteDay, [dayId]);
  
  // Reorder remaining days to close the gap
  const remainingDays = executeQuery('SELECT * FROM days WHERE day_order > ? ORDER BY day_order', [day.day_order]);
  for (const remainingDay of remainingDays) {
    await executeUpdate(queries.updateDayOrder, [remainingDay.day_order - 1, remainingDay.id]);
  }
}

export function getNextDayOfWeek(currentDayName) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentIndex = daysOfWeek.indexOf(currentDayName);
  
  if (currentIndex === -1) {
    return 'Monday'; // Default if not found
  }
  
  return daysOfWeek[(currentIndex + 1) % 7];
}

export async function updateDayNotes(dayId, notes) {
  await executeUpdate('UPDATE days SET notes = ? WHERE id = ?', [notes, dayId]);
}

export async function updateDayName(dayId, dayName) {
  await executeUpdate('UPDATE days SET day_name = ? WHERE id = ?', [dayName, dayId]);
}

/**
 * Duplicate a day (including its workout groups and sets)
 * Appends the new day at the end of the sequence
 * @param {number} dayId - The day ID to duplicate
 * @returns {number} The ID of the newly created day
 */
export async function duplicateDay(dayId) {
  const db = getDatabase();
  
  // Get the source day
  const sourceDay = getDayById(dayId);
  if (!sourceDay) {
    throw new Error('Day not found');
  }
  
  // Generate unique name by appending " (Copy)" until unique
  let newDayName = `${sourceDay.day_name} (Copy)`;
  let existingDays = getAllDays();
  
  while (existingDays.some(d => d.day_name.toLowerCase() === newDayName.toLowerCase())) {
    newDayName = `${newDayName} (Copy)`;
  }
  
  // Create new day at end of sequence
  const newDayId = await addDay(newDayName, null, sourceDay.notes || '');
  
  // Copy day_workout_groups
  const dayWorkoutGroups = getDayWorkoutGroups(dayId);
  if (dayWorkoutGroups.length > 0) {
    const stmt = db.prepare(queries.insertDayWorkoutGroup);
    dayWorkoutGroups.forEach(dwg => {
      stmt.run([newDayId, dwg.workout_group_id]);
    });
    stmt.free();
  }
  
  // Copy workout_sets
  const workoutSets = getWorkoutSetsByDay(dayId);
  if (workoutSets.length > 0) {
    const stmt = db.prepare(queries.insertWorkoutSet);
    workoutSets.forEach(set => {
      stmt.run([
        newDayId,
        set.exercise_id,
        set.exercise_order,
        set.set_order,
        set.reps,
        set.weight,
        set.rir,
        set.notes || ''
      ]);
    });
    stmt.free();
  }
  
  await saveDatabaseToIndexedDB();
  return newDayId;
}

// ===== WORKOUT GROUPS =====

export function getAllWorkoutGroups() {
  return executeQuery(queries.getAllWorkoutGroups);
}

export function getWorkoutGroupById(id) {
  return executeQueryOne(queries.getWorkoutGroupById, [id]);
}

export async function createWorkoutGroup(name, notes = '', id = null) {
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO workout_groups (id, name, notes) VALUES (?, ?, ?)', [id, name, notes]);
  }
  
  return await executeInsert(queries.insertWorkoutGroup, [name, notes]);
}

export async function updateWorkoutGroup(id, name, notes = '') {
  await executeUpdate(queries.updateWorkoutGroup, [name, notes, id]);
}

export async function deleteWorkoutGroup(id) {
  await executeUpdate(queries.deleteWorkoutGroup, [id]);
}

// ===== EXERCISES =====

export function getAllExercises() {
  return executeQuery(queries.getAllExercises);
}

export function getExerciseById(id) {
  return executeQueryOne(queries.getExerciseById, [id]);
}

export function getExercisesByWorkoutGroup(workoutGroupId) {
  return executeQuery(queries.getExercisesByWorkoutGroup, [workoutGroupId]);
}

export function getExercisesByWorkoutGroups(workoutGroupIds) {
  if (!workoutGroupIds || workoutGroupIds.length === 0) {
    return [];
  }
  
  const placeholders = workoutGroupIds.map(() => '?').join(',');
  const query = queries.getExercisesByWorkoutGroups.replace('{ids}', placeholders);
  return executeQuery(query, workoutGroupIds);
}

export async function createExercise(workoutGroupId, name, notes = '', id = null) {
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO exercises (id, workout_group_id, name, notes) VALUES (?, ?, ?, ?)', [id, workoutGroupId, name, notes]);
  }
  
  return await executeInsert(queries.insertExercise, [workoutGroupId, name, notes]);
}

export async function updateExercise(id, workoutGroupId, name, notes = '') {
  await executeUpdate(queries.updateExercise, [workoutGroupId, name, notes, id]);
}

export async function deleteExercise(id) {
  await executeUpdate(queries.deleteExercise, [id]);
}

// ===== DAY WORKOUT GROUPS =====

export function getDayWorkoutGroups(dayId) {
  return executeQuery(queries.getDayWorkoutGroups, [dayId]);
}

export async function setDayWorkoutGroups(dayId, workoutGroupIds) {
  const db = getDatabase();
  
  // Delete existing associations
  db.run(queries.deleteDayWorkoutGroups, [dayId]);
  
  // Insert new associations
  if (workoutGroupIds && workoutGroupIds.length > 0) {
    const stmt = db.prepare(queries.insertDayWorkoutGroup);
    workoutGroupIds.forEach(groupId => {
      stmt.run([dayId, groupId]);
    });
    stmt.free();
  }
  
  await saveDatabaseToIndexedDB();
}

export async function addDayWorkoutGroup(dayId, workoutGroupId) {
  await executeUpdate(queries.insertDayWorkoutGroup, [dayId, workoutGroupId]);
}

export async function removeDayWorkoutGroup(dayId, workoutGroupId) {
  await executeUpdate(queries.deleteDayWorkoutGroup, [dayId, workoutGroupId]);
}

// ===== WORKOUT SETS (replaces day_exercises + sets) =====

/**
 * Get all workout sets with full details
 */
export function getAllWorkoutSets() {
  return executeQuery(queries.getAllWorkoutSets);
}

/**
 * Get all workout sets for a specific day
 */
export function getWorkoutSetsByDay(dayId) {
  return executeQuery(queries.getWorkoutSetsByDay, [dayId]);
}

/**
 * Get all sets for a specific exercise on a specific day
 */
export function getWorkoutSetsByDayAndExercise(dayId, exerciseId) {
  return executeQuery(queries.getWorkoutSetsByDayAndExercise, [dayId, exerciseId]);
}

/**
 * Get a single workout set by ID
 */
export function getWorkoutSetById(id) {
  return executeQueryOne(queries.getWorkoutSetById, [id]);
}

/**
 * Get distinct exercises used on a day (with their order)
 */
export function getExercisesByDay(dayId) {
  return executeQuery(queries.getExercisesByDay, [dayId]);
}

/**
 * Get workout sets grouped by exercise for a day
 * Returns array of { exercise_id, exercise_name, exercise_order, sets: [...] }
 */
export function getWorkoutSetsByDayGrouped(dayId) {
  const allSets = getWorkoutSetsByDay(dayId);
  
  // Group by exercise
  const grouped = {};
  allSets.forEach(set => {
    const key = `${set.exercise_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        exercise_notes: set.exercise_notes,
        exercise_order: set.exercise_order,
        workout_group_name: set.workout_group_name,
        workout_group_id: set.workout_group_id,
        sets: []
      };
    }
    grouped[key].sets.push({
      id: set.id,
      set_order: set.set_order,
      reps: set.reps,
      weight: set.weight,
      rir: set.rir,
      notes: set.notes
    });
  });
  
  // Convert to array and sort by exercise_order
  return Object.values(grouped).sort((a, b) => a.exercise_order - b.exercise_order);
}

/**
 * Create a new workout set
 * @param {number} dayId - Day ID
 * @param {number} exerciseId - Exercise ID
 * @param {number|null} exerciseOrder - Order of exercise within day (auto-calculated if null)
 * @param {number|null} setOrder - Order of set within exercise (auto-calculated if null)
 * @param {number|null} reps - Number of reps
 * @param {number|null} weight - Weight
 * @param {number|null} rir - RIR value
 * @param {string} notes - Notes
 * @param {number|null} id - Specific ID (for imports)
 */
export async function createWorkoutSet(dayId, exerciseId, exerciseOrder = null, setOrder = null, reps = null, weight = null, rir = null, notes = '', id = null) {
  // Get exercise order if not provided
  if (exerciseOrder === null) {
    // Check if this exercise already exists on this day
    const existingSets = getWorkoutSetsByDayAndExercise(dayId, exerciseId);
    
    if (existingSets.length > 0) {
      // Exercise exists, use its order
      exerciseOrder = existingSets[0].exercise_order;
    } else {
      // New exercise, get next order
      const result = executeQueryOne(queries.getMaxExerciseOrder, [dayId]);
      exerciseOrder = (result && result.max_order ? result.max_order : 0) + 1;
    }
  }
  
  // Get set order if not provided
  if (setOrder === null) {
    const result = executeQueryOne(queries.getMaxSetOrder, [dayId, exerciseId]);
    setOrder = (result && result.max_order ? result.max_order : 0) + 1;
  }
  
  if (id !== null) {
    // Insert with specific ID (for imports)
    return await executeInsert(
      'INSERT INTO workout_sets (id, day_id, exercise_id, exercise_order, set_order, reps, weight, rir, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, dayId, exerciseId, exerciseOrder, setOrder, reps, weight, rir, notes]
    );
  }
  
  return await executeInsert(queries.insertWorkoutSet, [dayId, exerciseId, exerciseOrder, setOrder, reps, weight, rir, notes]);
}

/**
 * Update a workout set
 */
export async function updateWorkoutSet(id, exerciseOrder, setOrder, reps, weight, rir, notes = '') {
  await executeUpdate(queries.updateWorkoutSet, [exerciseOrder, setOrder, reps, weight, rir, notes, id]);
}

/**
 * Delete a workout set
 */
export async function deleteWorkoutSet(id) {
  await executeUpdate(queries.deleteWorkoutSet, [id]);
}

/**
 * Delete all sets for a specific exercise on a day
 * Used when removing an exercise from a day
 */
export async function deleteWorkoutSetsByDayAndExercise(dayId, exerciseId) {
  await executeUpdate(queries.deleteWorkoutSetsByDayAndExercise, [dayId, exerciseId]);
}

/**
 * Delete all sets for a day
 */
export async function deleteWorkoutSetsByDay(dayId) {
  await executeUpdate(queries.deleteWorkoutSetsByDay, [dayId]);
}

/**
 * Get count of sets for a day/exercise combination
 */
export function getSetCount(dayId, exerciseId) {
  const result = executeQueryOne(queries.getSetCount, [dayId, exerciseId]);
  return result ? result.count : 0;
}

// ===== DATA MANAGEMENT =====

/**
 * Clear all workout data (workout_sets and day_workout_groups)
 * Keeps workout groups and exercises intact
 */
export async function clearWorkoutData() {
  const db = getDatabase();
  db.run('DELETE FROM workout_sets');
  db.run('DELETE FROM day_workout_groups');
  db.run('DELETE FROM days');
  await saveDatabaseToIndexedDB();
}

/**
 * Clear entire database (everything including days)
 * Removes all data from all tables but keeps the database structure
 */
export async function clearAllData() {
  // Clear all data from tables
  await resetDatabase();
}

/**
 * Seed sample data (workout groups, exercises, and days)
 */
export async function seedSampleData() {
  await seedInitialData();
  await saveDatabaseToIndexedDB();
}

// ===== AUTO-PROGRAMMING (STUB) =====

/**
 * Generate workout program automatically
 * THIS IS A STUB - Not implemented yet
 */
export function generateWorkoutProgram(options = {}) {
  console.log('Auto-programming feature coming soon!');
  return {
    success: false,
    message: 'Auto-programming feature is not yet implemented. This will be added in a future update.'
  };
}
