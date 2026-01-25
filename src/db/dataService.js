import { getDatabase, saveDatabaseToIndexedDB } from './database.js';
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

// ===== WORKOUT GROUPS =====

export function getAllWorkoutGroups() {
  return executeQuery(queries.getAllWorkoutGroups);
}

export function getWorkoutGroupById(id) {
  return executeQueryOne(queries.getWorkoutGroupById, [id]);
}

export async function createWorkoutGroup(name, notes = '') {
  await executeUpdate(queries.insertWorkoutGroup, [name, notes]);
  return getLastInsertId();
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

export async function createExercise(workoutGroupId, name, notes = '') {
  await executeUpdate(queries.insertExercise, [workoutGroupId, name, notes]);
  return getLastInsertId();
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

// ===== SETS =====

export function getAllSets() {
  return executeQuery(queries.getAllSets);
}

export function getSetsByDay(dayId) {
  return executeQuery(queries.getSetsByDay, [dayId]);
}

export function getSetsByDayAndExercise(dayId, exerciseId) {
  return executeQuery(queries.getSetsByDayAndExercise, [dayId, exerciseId]);
}

export function getSetById(id) {
  return executeQueryOne(queries.getSetById, [id]);
}

export async function createSet(dayId, exerciseId, reps = null, rir = null, notes = '') {
  // Get next set order
  const result = executeQueryOne(queries.getMaxSetOrder, [dayId, exerciseId]);
  const setOrder = (result && result.max_order ? result.max_order : 0) + 1;
  
  await executeUpdate(queries.insertSet, [dayId, exerciseId, setOrder, reps, rir, notes]);
  return getLastInsertId();
}

export async function updateSet(id, setOrder, reps, rir, notes = '') {
  await executeUpdate(queries.updateSet, [setOrder, reps, rir, notes, id]);
}

export async function deleteSet(id) {
  await executeUpdate(queries.deleteSet, [id]);
}

export async function deleteSetsByDay(dayId) {
  await executeUpdate(queries.deleteSetsByDay, [dayId]);
}

export async function deleteSetsByDayAndExercise(dayId, exerciseId) {
  await executeUpdate(queries.deleteSetsByDayAndExercise, [dayId, exerciseId]);
}

// ===== CSV EXPORT/IMPORT =====

/**
 * Export all data to CSV format
 * Returns CSV string with denormalized data
 */
export function exportToCSV() {
  const data = executeQuery(queries.getExportData);
  
  // Convert to CSV format
  const csv = Papa.unparse(data, {
    columns: [
      'day_name',
      'day_order',
      'workout_group_name',
      'exercise_name',
      'exercise_notes',
      'set_order',
      'reps',
      'rir',
      'set_notes'
    ],
    header: true
  });
  
  return csv;
}

/**
 * Download CSV file
 */
export function downloadCSV() {
  const csv = exportToCSV();
  const date = new Date().toISOString().split('T')[0];
  const filename = `workout-program-${date}.csv`;
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Import data from CSV
 * Clears existing sets and rebuilds from CSV
 */
export async function importFromCSV(csvString) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const db = getDatabase();
          
          // Clear existing sets
          db.run('DELETE FROM sets');
          
          // Track workout groups and exercises to create/find
          const workoutGroupMap = new Map();
          const exerciseMap = new Map();
          
          // Get existing workout groups
          const existingGroups = getAllWorkoutGroups();
          existingGroups.forEach(group => {
            workoutGroupMap.set(group.name, group.id);
          });
          
          // Get existing exercises
          const existingExercises = getAllExercises();
          existingExercises.forEach(exercise => {
            exerciseMap.set(`${exercise.workout_group_id}-${exercise.name}`, exercise.id);
          });
          
          // Process each row
          for (const row of results.data) {
            const {
              day_name,
              day_order,
              workout_group_name,
              exercise_name,
              exercise_notes,
              set_order,
              reps,
              rir,
              set_notes
            } = row;
            
            // Find or create workout group
            let workoutGroupId = workoutGroupMap.get(workout_group_name);
            if (!workoutGroupId) {
              workoutGroupId = await createWorkoutGroup(workout_group_name, '');
              workoutGroupMap.set(workout_group_name, workoutGroupId);
            }
            
            // Find or create exercise
            const exerciseKey = `${workoutGroupId}-${exercise_name}`;
            let exerciseId = exerciseMap.get(exerciseKey);
            if (!exerciseId) {
              exerciseId = await createExercise(workoutGroupId, exercise_name, exercise_notes || '');
              exerciseMap.set(exerciseKey, exerciseId);
            }
            
            // Find day ID
            const day = executeQueryOne('SELECT id FROM days WHERE day_name = ?', [day_name]);
            if (!day) {
              console.warn(`Day not found: ${day_name}`);
              continue;
            }
            
            // Insert set
            db.run(queries.insertSet, [
              day.id,
              exerciseId,
              parseInt(set_order) || 1,
              parseInt(reps) || null,
              parseInt(rir) || null,
              set_notes || ''
            ]);
          }
          
          await saveDatabaseToIndexedDB();
          resolve({ success: true, rowCount: results.data.length });
        } catch (error) {
          console.error('Error importing CSV:', error);
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
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
