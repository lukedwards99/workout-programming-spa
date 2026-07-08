import { createDatabaseSQL } from './ddl';

const IDB_NAME = 'workout-programming-v3';
const IDB_STORE = 'databases';
const CURRENT_SCHEMA = 1;

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
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
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
    const ver = db.exec('SELECT MAX(version) FROM schema_version');
    const current = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : 0;
    if (current < CURRENT_SCHEMA) {
      // Future: run migrations here
    }
  } else {
    db = new sql.Database();
    db.run(createDatabaseSQL);
    await saveToIndexedDB();
  }
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
        const ver = newDb.exec('SELECT MAX(version) FROM schema_version');
        const version = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : null;
        if (version === null) {
          newDb.close();
          reject(new Error('File does not contain workout app data.'));
          return;
        }
        if (db) db.close();
        db = newDb;
        await saveToIndexedDB();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
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
