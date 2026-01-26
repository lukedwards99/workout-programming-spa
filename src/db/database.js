import { schema } from './databaseDDL.js';

// Schema version - increment this when making schema changes to force rebuild
const SCHEMA_VERSION = 2; // Added weight column to sets table

let db = null;
let SQL = null;

/**
 * Initialize the SQLite database
 * Loads sql.js WASM and creates/restores database from IndexedDB
 */
export async function initDatabase() {
  try {
    // Dynamically import sql.js
    const sqlModule = await import('sql.js');
    const initSqlJs = sqlModule.default || sqlModule;
    
    // Initialize sql.js
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    // Try to load existing database from IndexedDB
    const savedDb = await loadDatabaseFromIndexedDB();
    
    if (savedDb) {
      db = new SQL.Database(savedDb);
      
      // Check schema version
      const currentVersion = getSchemaVersion();
      
      if (currentVersion !== SCHEMA_VERSION) {
        console.log(`Schema version mismatch (current: ${currentVersion}, expected: ${SCHEMA_VERSION}). Rebuilding database...`);
        await rebuildDatabase();
      } else {
        console.log('Database loaded from IndexedDB');
      }
    } else {
      // Create new database
      db = new SQL.Database();
      console.log('New database created');
      
      // Create tables
      await createTables();
      
      // Set schema version
      setSchemaVersion(SCHEMA_VERSION);
      
      // Save to IndexedDB
      await saveDatabaseToIndexedDB();
    }

    // Optimize SQLite memory settings
    // Note: These settings improve performance and reduce memory errors
    // db.run('PRAGMA cache_size = 10000');        // 10000 pages (~40MB cache)
    // db.run('PRAGMA page_size = 4096');          // 4KB pages
    // db.run('PRAGMA temp_store = MEMORY');       // Use memory for temp storage
    // db.run('PRAGMA journal_mode = MEMORY');     // Keep journal in memory
    // db.run('PRAGMA synchronous = OFF');         // Disable sync for better performance

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Create all database tables
 */
async function createTables() {
  db.run(schema);
}

/**
 * Get the current schema version from the database
 */
function getSchemaVersion() {
  try {
    const result = db.exec('PRAGMA user_version');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Set the schema version in the database
 */
function setSchemaVersion(version) {
  db.run(`PRAGMA user_version = ${version}`);
}

/**
 * Rebuild the database with the current schema
 * Drops all tables and recreates them
 */
async function rebuildDatabase() {
  try {
    // Drop all existing tables
    db.run('DROP TABLE IF EXISTS sets');
    db.run('DROP TABLE IF EXISTS day_exercises');
    db.run('DROP TABLE IF EXISTS day_workout_groups');
    db.run('DROP TABLE IF EXISTS exercises');
    db.run('DROP TABLE IF EXISTS workout_groups');
    db.run('DROP TABLE IF EXISTS days');
    
    // Recreate tables with new schema
    await createTables();
    
    // Set new schema version
    setSchemaVersion(SCHEMA_VERSION);
    
    console.log('Database rebuilt with new schema');
    
    // Save to IndexedDB
    await saveDatabaseToIndexedDB();
  } catch (error) {
    console.error('Error rebuilding database:', error);
    throw error;
  }
}

/**
 * Seed initial data (7 days + sample workout groups and exercises)
 * Uses INSERT OR IGNORE to skip existing data and prevent conflicts
 */
export async function seedInitialData() {
  // Check if days already exist
  const dayCount = db.exec('SELECT COUNT(*) as count FROM days')[0]?.values[0][0] || 0;
  
  // Only insert days if none exist
  if (dayCount === 0) {
    const daysData = [
      [1, 'Monday', 1],
      [2, 'Tuesday', 2],
      [3, 'Wednesday', 3],
      [4, 'Thursday', 4],
      [5, 'Friday', 5],
      [6, 'Saturday', 6],
      [7, 'Sunday', 7]
    ];

    const insertDay = db.prepare('INSERT INTO days (id, day_name, day_order) VALUES (?, ?, ?)');
    daysData.forEach(day => insertDay.run(day));
    insertDay.free();
  }

  // Insert sample workout groups (use OR IGNORE to skip duplicates)
  const workoutGroups = [
    ['Chest', 'Chest exercises'],
    ['Back', 'Back exercises'],
    ['Legs', 'Leg exercises'],
    ['Shoulders', 'Shoulder exercises'],
    ['Arms', 'Arm exercises'],
    ['Cardio', 'Cardiovascular training'],
    ['Rest', 'Rest and recovery']
  ];

  const insertGroup = db.prepare('INSERT OR IGNORE INTO workout_groups (name, notes) VALUES (?, ?)');
  workoutGroups.forEach(group => insertGroup.run(group));
  insertGroup.free();

  // Get workout group IDs dynamically
  const groupIds = {};
  const groups = db.exec('SELECT id, name FROM workout_groups');
  if (groups.length > 0) {
    groups[0].values.forEach(row => {
      groupIds[row[1]] = row[0];
    });
  }

  // Insert sample exercises using dynamic IDs (OR IGNORE to skip duplicates)
  const exercises = [
    [groupIds['Chest'], 'Barbell Bench Press', 'Compound chest movement'],
    [groupIds['Chest'], 'Incline Dumbbell Press', 'Upper chest focus'],
    [groupIds['Chest'], 'Cable Flyes', 'Chest isolation'],
    [groupIds['Back'], 'Deadlift', 'Compound back and posterior chain'],
    [groupIds['Back'], 'Pull-ups', 'Vertical pulling movement'],
    [groupIds['Back'], 'Barbell Rows', 'Horizontal pulling movement'],
    [groupIds['Legs'], 'Back Squat', 'Compound leg movement'],
    [groupIds['Legs'], 'Romanian Deadlift', 'Hamstring focus'],
    [groupIds['Legs'], 'Leg Press', 'Quad focus'],
    [groupIds['Shoulders'], 'Overhead Press', 'Compound shoulder movement'],
    [groupIds['Shoulders'], 'Lateral Raises', 'Lateral delt isolation'],
    [groupIds['Shoulders'], 'Face Pulls', 'Rear delt and upper back'],
    [groupIds['Arms'], 'Barbell Curls', 'Bicep compound'],
    [groupIds['Arms'], 'Tricep Dips', 'Tricep compound'],
    [groupIds['Arms'], 'Hammer Curls', 'Bicep and forearm'],
    [groupIds['Cardio'], 'Treadmill', 'Running or walking'],
    [groupIds['Cardio'], 'Cycling', 'Low impact cardio'],
    [groupIds['Cardio'], 'Rowing Machine', 'Full body cardio'],
    [groupIds['Rest'], 'Rest Day', 'Active recovery']
  ];

  const insertExercise = db.prepare('INSERT OR IGNORE INTO exercises (workout_group_id, name, notes) VALUES (?, ?, ?)');
  exercises.forEach(exercise => {
    if (exercise[0]) { // Only insert if workout group ID exists
      insertExercise.run(exercise);
    }
  });
  insertExercise.free();
}

/**
 * Get the database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save database to IndexedDB for persistence
 */
export async function saveDatabaseToIndexedDB() {
  try {
    const data = db.export();
    const buffer = data.buffer;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WorkoutProgrammingDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        const dbInstance = request.result;
        const transaction = dbInstance.transaction(['database'], 'readwrite');
        const store = transaction.objectStore('database');
        const putRequest = store.put(buffer, 'sqliteDb');
        
        putRequest.onsuccess = () => {
          console.log('Database saved to IndexedDB');
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        if (!dbInstance.objectStoreNames.contains('database')) {
          dbInstance.createObjectStore('database');
        }
      };
    });
  } catch (error) {
    console.error('Error saving database to IndexedDB:', error);
    throw error;
  }
}

/**
 * Load database from IndexedDB
 */
async function loadDatabaseFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WorkoutProgrammingDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const dbInstance = request.result;
      
      if (!dbInstance.objectStoreNames.contains('database')) {
        resolve(null);
        return;
      }
      
      const transaction = dbInstance.transaction(['database'], 'readonly');
      const store = transaction.objectStore('database');
      const getRequest = store.get('sqliteDb');
      
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          resolve(new Uint8Array(getRequest.result));
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains('database')) {
        dbInstance.createObjectStore('database');
      }
    };
  });
}

/**
 * Clear all data from database tables
 * Keeps the database structure intact but removes all rows
 * Safer than deleting the entire database - avoids race conditions
 */
export async function resetDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    // Delete all data from tables in reverse dependency order
    db.run('DELETE FROM sets');
    db.run('DELETE FROM day_exercises');
    db.run('DELETE FROM day_workout_groups');
    db.run('DELETE FROM days');
    db.run('DELETE FROM exercises');
    db.run('DELETE FROM workout_groups');
    
    // Reset autoincrement sequences
    db.run('DELETE FROM sqlite_sequence');
    
    console.log('All data cleared from database');
    await saveDatabaseToIndexedDB();
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}
