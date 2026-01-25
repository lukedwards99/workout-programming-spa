import { schema } from './databaseDDL.js';

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
      console.log('Database loaded from IndexedDB');
    } else {
      // Create new database
      db = new SQL.Database();
      console.log('New database created');
      
      // Create tables
      await createTables();
      
      // Save to IndexedDB
      await saveDatabaseToIndexedDB();
    }

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
 * Clear all data and reset database
 */
export async function resetDatabase() {
  if (db) {
    db.close();
  }
  
  // Clear IndexedDB
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('WorkoutProgrammingDB');
    request.onsuccess = () => {
      console.log('Database reset');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
