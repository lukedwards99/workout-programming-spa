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

export async function addDay(dayName) {
  // Get next day order
  const result = executeQueryOne(queries.getMaxDayOrder);
  const nextOrder = (result && result.max_order ? result.max_order : 0) + 1;
  
  return await executeInsert(queries.insertDay, [dayName, nextOrder]);
}

export async function removeLastDay() {
  const count = getDaysCount();
  if (count === 0) {
    throw new Error('No days to remove');
  }
  
  await executeUpdate(queries.deleteLastDay);
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

export async function createWorkoutGroup(name, notes = '') {
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

export async function createExercise(workoutGroupId, name, notes = '') {
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
  
  return await executeInsert(queries.insertSet, [dayId, exerciseId, setOrder, reps, rir, notes]);
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

/**
 * Export setup data (workout groups and exercises) to CSV
 * Returns CSV string with workout groups and exercises
 */
export function exportSetupDataToCSV() {
  const workoutGroups = getAllWorkoutGroups();
  const exercises = getAllExercises();
  
  // Create rows with type identifier
  const rows = [];
  
  // Add workout groups
  workoutGroups.forEach(group => {
    rows.push({
      type: 'group',
      id: group.id,
      workout_group_id: '',
      name: group.name,
      notes: group.notes || ''
    });
  });
  
  // Add exercises
  exercises.forEach(exercise => {
    rows.push({
      type: 'exercise',
      id: exercise.id,
      workout_group_id: exercise.workout_group_id,
      name: exercise.name,
      notes: exercise.notes || ''
    });
  });
  
  const csv = Papa.unparse(rows, {
    columns: ['type', 'id', 'workout_group_id', 'name', 'notes'],
    header: true
  });
  
  return csv;
}

/**
 * Download setup data CSV file
 */
export function downloadSetupDataCSV() {
  const csv = exportSetupDataToCSV();
  const date = new Date().toISOString().split('T')[0];
  const filename = `workout-setup-${date}.csv`;
  
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
 * Import setup data from CSV
 * Clears existing workout groups and exercises, then rebuilds from CSV
 */
export async function importSetupDataFromCSV(csvString) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const db = getDatabase();
          
          // Clear existing data
          db.run('DELETE FROM sets');
          db.run('DELETE FROM day_workout_groups');
          db.run('DELETE FROM exercises');
          db.run('DELETE FROM workout_groups');
          
          // Track ID mappings (old ID -> new ID)
          const groupIdMap = new Map();
          
          // First pass: Create all workout groups
          for (const row of results.data) {
            if (row.type === 'group') {
              const oldId = parseInt(row.id);
              console.log(`Creating group: ${row.name}, oldId: ${oldId}, raw id: ${row.id}`);
              const newId = await createWorkoutGroup(row.name, row.notes || '');
              console.log(`Created group with newId: ${newId}`);
              groupIdMap.set(oldId, newId);
            }
          }
          
          console.log('Group ID Map:', Array.from(groupIdMap.entries()));
          
          // Second pass: Create all exercises with mapped workout group IDs
          for (const row of results.data) {
            if (row.type === 'exercise') {
              const oldGroupId = parseInt(row.workout_group_id);
              console.log(`Processing exercise: ${row.name}, oldGroupId: ${oldGroupId}, raw workout_group_id: ${row.workout_group_id}`);
              const newGroupId = groupIdMap.get(oldGroupId);
              console.log(`Mapped to newGroupId: ${newGroupId}, type: ${typeof newGroupId}`);
              console.log(`Map has key ${oldGroupId}:`, groupIdMap.has(oldGroupId));
              
              // Check if newGroupId exists and is a valid number
              if (newGroupId && typeof newGroupId === 'number') {
                await createExercise(newGroupId, row.name, row.notes || '');
                console.log(`Created exercise: ${row.name}`);
              } else {
                console.warn(`Workout group not found for exercise: ${row.name}, looking for oldGroupId: ${oldGroupId}`);
                console.warn('Available group IDs:', Array.from(groupIdMap.keys()));
                console.warn('Full map:', Array.from(groupIdMap.entries()));
              }
            }
          }
          
          await saveDatabaseToIndexedDB();
          resolve({ success: true, rowCount: results.data.length });
        } catch (error) {
          console.error('Error importing setup data:', error);
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

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
 * Clear entire database (everything except the 7 days)
 * Clears workout groups, exercises, sets, and day workout groups
 */
export async function clearAllData() {
  const db = getDatabase();
  db.run('DELETE FROM sets');
  db.run('DELETE FROM day_workout_groups');
  db.run('DELETE FROM exercises');
  db.run('DELETE FROM days');
  db.run('DELETE FROM workout_groups');
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
