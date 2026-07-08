import { createDatabaseSQL } from './ddl';

const IDB_NAME = 'workout-programming-v3';
const IDB_STORE = 'databases';
const CURRENT_SCHEMA = 2;

let SQL = null;
let db = null;

function getDb() {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });
  return SQL;
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveToIndexedDB() {
  const data = getDb().export();
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, `v${CURRENT_SCHEMA}`);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function loadFromIndexedDB() {
  const idb = await openIndexedDB();
  return await new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(`v${CURRENT_SCHEMA}`);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function initDatabase() {
  const sql = await loadSqlJs();
  const saved = await loadFromIndexedDB();

  if (saved) {
    db = new sql.Database(saved);
    db.run('PRAGMA foreign_keys = ON');
    const ver = db.exec('SELECT MAX(version) FROM schema_version');
    const current = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : 0;
    if (current < CURRENT_SCHEMA) {
      if (current === 0 || current === 1) {
        db.run(`DROP TABLE IF EXISTS workout_sets`);
        db.run(`DROP TABLE IF EXISTS exercise_variations`);
        db.run(`DROP TABLE IF EXISTS exercises`);
        db.run(`DROP TABLE IF EXISTS exercise_groups`);
        db.run(`
          CREATE TABLE IF NOT EXISTS exercise_groups (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            program_id INTEGER NOT NULL,
            name       TEXT    NOT NULL,
            notes      TEXT,
            FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
            UNIQUE(program_id, name)
          );
          CREATE TABLE IF NOT EXISTS exercises (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise_group_id INTEGER NOT NULL,
            name              TEXT    NOT NULL,
            tutorial_url      TEXT,
            notes             TEXT,
            FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE
          );
          CREATE TABLE IF NOT EXISTS exercise_variations (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise_id  INTEGER NOT NULL,
            name         TEXT    NOT NULL,
            is_primary   INTEGER NOT NULL DEFAULT 0,
            tutorial_url TEXT,
            notes        TEXT,
            FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
          );
          CREATE TABLE IF NOT EXISTS workout_sets (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            workout_id            INTEGER NOT NULL,
            exercise_id           INTEGER NOT NULL,
            exercise_variation_id INTEGER,
            exercise_order        INTEGER NOT NULL,
            set_number            INTEGER NOT NULL,
            set_type              TEXT    NOT NULL DEFAULT 'normal',
            reps                  INTEGER,
            weight                REAL,
            rir                   INTEGER,
            notes                 TEXT,
            FOREIGN KEY (workout_id)            REFERENCES workouts(id)             ON DELETE CASCADE,
            FOREIGN KEY (exercise_id)           REFERENCES exercises(id)            ON DELETE CASCADE,
            FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id)  ON DELETE SET NULL
          );
        `);
        db.run(`INSERT OR REPLACE INTO schema_version (version) VALUES (${CURRENT_SCHEMA});`);
      }
    }
  } else {
    db = new sql.Database();
    db.run(createDatabaseSQL);
    db.run('PRAGMA foreign_keys = ON');
    await saveToIndexedDB();
  }

  // Flush saves when page is hidden/unloaded
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveNow().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    saveNow().catch(() => {});
  });

  return db;
}

let autoSaveTimer = null;
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      await saveToIndexedDB();
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, 300);
}

async function saveNow() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  await saveToIndexedDB();
}

function exportDatabase() {
  return getDb().export();
}

async function importDatabase(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const sql = await loadSqlJs();
        const arr = new Uint8Array(e.target.result);
        const header = new TextDecoder().decode(arr.slice(0, 16));
        if (!header.startsWith('SQLite format 3')) {
          reject(new Error('Not a valid SQLite database file.'));
          return;
        }
        const newDb = new sql.Database(arr);
        newDb.run('PRAGMA foreign_keys = ON');
        const ver = newDb.exec('SELECT MAX(version) FROM schema_version');
        const version = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : null;
        if (version === null) {
          newDb.close();
          reject(new Error('File does not contain workout app data.'));
          return;
        }
        if (version > CURRENT_SCHEMA) {
          newDb.close();
          reject(new Error(`Database version ${version} is newer than the supported version ${CURRENT_SCHEMA}. Please update the app.`));
          return;
        }
        if (!validateTableStructure(newDb)) {
          newDb.close();
          reject(new Error('Imported database is missing required tables/columns and cannot be used.'));
          return;
        }
        // Run migrations for older versions
        if (version < CURRENT_SCHEMA) {
          if (version <= 1) {
            newDb.run(`DROP TABLE IF EXISTS workout_sets`);
            newDb.run(`DROP TABLE IF EXISTS exercise_variations`);
            newDb.run(`DROP TABLE IF EXISTS exercises`);
            newDb.run(`DROP TABLE IF EXISTS exercise_groups`);
            newDb.run(`CREATE TABLE IF NOT EXISTS exercise_groups (
              id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL,
              name TEXT NOT NULL, notes TEXT,
              FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
              UNIQUE(program_id, name));
              CREATE TABLE IF NOT EXISTS exercises (
              id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_group_id INTEGER NOT NULL,
              name TEXT NOT NULL, tutorial_url TEXT, notes TEXT,
              FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE);
              CREATE TABLE IF NOT EXISTS exercise_variations (
              id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL,
              name TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0,
              tutorial_url TEXT, notes TEXT,
              FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE);
              CREATE TABLE IF NOT EXISTS workout_sets (
              id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL,
              exercise_id INTEGER NOT NULL, exercise_variation_id INTEGER,
              exercise_order INTEGER NOT NULL, set_number INTEGER NOT NULL,
              set_type TEXT NOT NULL DEFAULT 'normal', reps INTEGER,
              weight REAL, rir INTEGER, notes TEXT,
              FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
              FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
              FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id) ON DELETE SET NULL);`);
            newDb.run(`INSERT OR REPLACE INTO schema_version (version) VALUES (${CURRENT_SCHEMA});`);
          }
        }
        const oldDb = db;
        db = newDb;
        await saveToIndexedDB();
        if (oldDb) oldDb.close();
        resolve();
      } catch (err) {
        reject(new Error(`Import failed: ${err.message || err}. Original database unchanged.`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

function validateTableStructure(database) {
  const requiredTables = {
    programs: ['id', 'name', 'created_at', 'notes'],
    mesocycles: ['id', 'program_id', 'name', 'length_days', 'notes', 'created_at'],
    workouts: ['id', 'mesocycle_id', 'name', 'day_offset', 'notes', 'sort_order'],
    exercise_groups: ['id', 'program_id', 'name', 'notes'],
    exercises: ['id', 'exercise_group_id', 'name', 'tutorial_url', 'notes'],
    exercise_variations: ['id', 'exercise_id', 'name', 'is_primary', 'tutorial_url', 'notes'],
    workout_sets: ['id', 'workout_id', 'exercise_id', 'exercise_variation_id', 'exercise_order', 'set_number', 'set_type', 'reps', 'weight', 'rir', 'notes'],
  };
  for (const [table, columns] of Object.entries(requiredTables)) {
    try {
      const info = database.exec(`PRAGMA table_info(${table})`);
      if (!info.length || !info[0].values.length) return false;
      const existingColumns = info[0].values.map((r) => r[1]);
      for (const col of columns) {
        if (!existingColumns.includes(col)) return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function deleteAllData() {
  const tables = [
    'workout_sets', 'exercise_variations', 'exercises', 'exercise_groups',
    'workouts', 'mesocycles', 'programs',
  ];
  for (const t of tables) {
    getDb().run(`DELETE FROM ${t}`);
  }
  await saveToIndexedDB();
}

function execSQL(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  scheduleAutoSave();
}

function queryAll(sql, params = []) {
  const results = [];
  const stmt = getDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function queryValue(sql, params = []) {
  const result = getDb().exec(sql, params);
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0].length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

function lastInsertRowId() {
  const result = getDb().exec('SELECT last_insert_rowid()');
  return result[0].values[0][0];
}

function getDatabaseSize() {
  return getDb().export().length;
}

export {
  initDatabase,
  getDb,
  exportDatabase,
  importDatabase,
  deleteAllData,
  execSQL,
  queryAll,
  queryOne,
  queryValue,
  lastInsertRowId,
  getDatabaseSize,
  saveNow,
};
