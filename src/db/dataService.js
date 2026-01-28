import { getDatabase, saveDatabaseToIndexedDB, resetDatabase, initDatabase, seedInitialData } from './database.js';
import { queries } from './queries.js';
import Papa from 'papaparse';

/**
 * Data Service
 * Handles all CRUD operations and data transformations
 * Auto-saves to IndexedDB after every modification
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

export async function addDay(dayName, id = null) {
  // Get next day order
  const result = executeQueryOne(queries.getMaxDayOrder);
  const nextOrder = (result && result.max_order ? result.max_order : 0) + 1;
  
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO days (id, day_name, day_order) VALUES (?, ?, ?)', [id, dayName, nextOrder]);
  }
  
  return await executeInsert(queries.insertDay, [dayName, nextOrder]);
}

export async function insertDayAfter(dayName, afterDayId) {
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
  return await executeInsert(queries.insertDay, [dayName, insertOrder]);
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

// ===== DAY EXERCISES =====

export function getAllDayExercises() {
  return executeQuery(queries.getAllDayExercises);
}

export function getDayExercisesByDay(dayId) {
  return executeQuery(queries.getDayExercisesByDay, [dayId]);
}

export function getDayExerciseById(id) {
  return executeQueryOne(queries.getDayExerciseById, [id]);
}

export async function createDayExercise(dayId, exerciseId, exerciseOrder = null, id = null) {
  // Get next exercise order for this day if not provided
  if (exerciseOrder === null) {
    const result = executeQueryOne(queries.getMaxExerciseOrder, [dayId]);
    exerciseOrder = (result && result.max_order ? result.max_order : 0) + 1;
  }
  
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO day_exercises (id, day_id, exercise_id, exercise_order) VALUES (?, ?, ?, ?)', [id, dayId, exerciseId, exerciseOrder]);
  }
  
  return await executeInsert(queries.insertDayExercise, [dayId, exerciseId, exerciseOrder]);
}

export async function updateDayExercise(id, exerciseId, exerciseOrder) {
  await executeUpdate(queries.updateDayExercise, [exerciseId, exerciseOrder, id]);
}

export async function deleteDayExercise(id) {
  await executeUpdate(queries.deleteDayExercise, [id]);
}

// ===== SETS =====

export function getAllSets() {
  return executeQuery(queries.getAllSets);
}

export function getSetsByDay(dayId) {
  return executeQuery(queries.getSetsByDay, [dayId]);
}

export function getSetsByDayExercise(dayExerciseId) {
  return executeQuery(queries.getSetsByDayExercise, [dayExerciseId]);
}

export function getSetById(id) {
  return executeQueryOne(queries.getSetById, [id]);
}

export async function createSet(dayExerciseId, reps = null, weight = null, rir = null, notes = '', setOrder = null, id = null) {
  // Get next set order for this day exercise if not provided
  if (setOrder === null) {
    const result = executeQueryOne(queries.getMaxSetOrder, [dayExerciseId]);
    setOrder = (result && result.max_order ? result.max_order : 0) + 1;
  }
  
  if (id !== null) {
    // Insert with specific ID
    return await executeInsert('INSERT INTO sets (id, day_exercise_id, set_order, reps, weight, rir, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, dayExerciseId, setOrder, reps, weight, rir, notes]);
  }
  
  return await executeInsert(queries.insertSet, [dayExerciseId, setOrder, reps, weight, rir, notes]);
}

export async function updateSet(id, setOrder, reps, weight, rir, notes = '') {
  await executeUpdate(queries.updateSet, [setOrder, reps, weight, rir, notes, id]);
}

export async function deleteSet(id) {
  await executeUpdate(queries.deleteSet, [id]);
}

export async function deleteSetsByDayExercise(dayExerciseId) {
  await executeUpdate(queries.deleteSetsByDayExercise, [dayExerciseId]);
}

// ===== CSV EXPORT/IMPORT =====
// NOTE: CSV functionality has been removed and will be rebuilt in Phase 2 with normalized format

/**
 * Clear all workout data (sets and day workout groups)
 * Keeps workout groups and exercises intact
 */
export async function clearWorkoutData() {
  const db = getDatabase();
  db.run('DELETE FROM sets');
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
