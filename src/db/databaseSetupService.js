import { createDatabaseSQL, deleteDatabaseSQL } from './sql.js';

const IDB_DB_NAME = 'workout-programming';
const IDB_STORE_NAME = 'schema-versions';

let SQL = null;
let db = null;

/**
 * Returns the active sql.js database instance.
 * Will be null if no database has been created or loaded yet.
 */
export function getDb() {
  return db;
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const sqlModule = await import('sql.js');
  const initSqlJs = sqlModule.default || sqlModule;
  SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });
  return SQL;
}

function openIndexDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE_NAME)) {
        idb.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Creates a fresh in-memory SQLite database and runs the DDL.
 * @param {number} schemaVersion - Schema version identifier (for future migration use).
 */
export async function createDatabase(schemaVersion) {
  const sql = await loadSqlJs();
  if (db) db.close();
  db = new sql.Database();
  db.run(createDatabaseSQL);
  return db;
}

/**
 * Drops all tables from the active database.
 * @param {number} schemaVersion - Schema version identifier.
 */
export function deleteDatabase(schemaVersion) {
  if (!db) throw new Error('No active database to delete.');
  db.run(deleteDatabaseSQL);
}

/**
 * Exports the active database binary and saves it to IndexedDB
 * under the key `v{schemaVersion}`, preserving any previously saved versions.
 * @param {number} schemaVersion - Schema version identifier.
 */
export async function saveDatabase(schemaVersion) {
  if (!db) throw new Error('No active database to save.');
  const data = db.export();
  const idb = await openIndexDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.put(data, `v${schemaVersion}`);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Loads a previously saved database binary from IndexedDB and restores it
 * as the active database instance.
 * @param {number} schemaVersion - Schema version identifier to load.
 */
export async function loadDatabase(schemaVersion) {
  console.debug("inside load database")
  const idb = await openIndexDB();
  const data = await new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(`v${schemaVersion}`);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
  if (!data) { // no saved database for this schema version, create a new one
    console.warn(`No saved database found for schema version v${schemaVersion}, creating new database.`);
    return createDatabase(schemaVersion);
  } else { // found saved database for this schema version, load it
    console.debug(`Saved database found for schema version v${schemaVersion}, loading from IndexedDB.`);
    const sql = await loadSqlJs();
    if (db) db.close();
    db = new sql.Database(data);
  }
    // throw new Error(`No saved database found for schema version v${schemaVersion}.`);

  console.log("completed loading of database")
  return db;
}
