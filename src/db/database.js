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
      
      // Seed initial data
      await seedInitialData();
      
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
  const schema = `
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY,
      day_name TEXT NOT NULL UNIQUE,
      day_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS workout_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_group_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS day_workout_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      workout_group_id INTEGER NOT NULL,
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE,
      UNIQUE(day_id, workout_group_id)
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_order INTEGER NOT NULL,
      reps INTEGER,
      rir INTEGER,
      notes TEXT,
      FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );
  `;

  db.run(schema);
}

/**
 * Seed initial data (7 days + sample workout groups and exercises)
 */
async function seedInitialData() {
  // Insert 7 days
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

  // Insert sample workout groups
  const workoutGroups = [
    ['Chest', 'Chest exercises'],
    ['Back', 'Back exercises'],
    ['Legs', 'Leg exercises'],
    ['Shoulders', 'Shoulder exercises'],
    ['Arms', 'Arm exercises'],
    ['Cardio', 'Cardiovascular training'],
    ['Rest', 'Rest and recovery']
  ];

  const insertGroup = db.prepare('INSERT INTO workout_groups (name, notes) VALUES (?, ?)');
  workoutGroups.forEach(group => insertGroup.run(group));
  insertGroup.free();

  // Insert sample exercises
  const exercises = [
    [1, 'Barbell Bench Press', 'Compound chest movement'],
    [1, 'Incline Dumbbell Press', 'Upper chest focus'],
    [1, 'Cable Flyes', 'Chest isolation'],
    [2, 'Deadlift', 'Compound back and posterior chain'],
    [2, 'Pull-ups', 'Vertical pulling movement'],
    [2, 'Barbell Rows', 'Horizontal pulling movement'],
    [3, 'Back Squat', 'Compound leg movement'],
    [3, 'Romanian Deadlift', 'Hamstring focus'],
    [3, 'Leg Press', 'Quad focus'],
    [4, 'Overhead Press', 'Compound shoulder movement'],
    [4, 'Lateral Raises', 'Lateral delt isolation'],
    [4, 'Face Pulls', 'Rear delt and upper back'],
    [5, 'Barbell Curls', 'Bicep compound'],
    [5, 'Tricep Dips', 'Tricep compound'],
    [5, 'Hammer Curls', 'Bicep and forearm'],
    [6, 'Treadmill', 'Running or walking'],
    [6, 'Cycling', 'Low impact cardio'],
    [6, 'Rowing Machine', 'Full body cardio'],
    [7, 'Rest Day', 'Active recovery']
  ];

  const insertExercise = db.prepare('INSERT INTO exercises (workout_group_id, name, notes) VALUES (?, ?, ?)');
  exercises.forEach(exercise => insertExercise.run(exercise));
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
