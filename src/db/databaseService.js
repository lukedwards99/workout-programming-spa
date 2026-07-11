import { createCatalogSQL, createProgramSQL, SCHEMA_VERSION } from './ddl';

const IDB_NAME = 'workout-programming-v3';
const IDB_STORE = 'databases';
const CATALOG_KEY = 'catalog-v1';
const PROGRAM_KEY_PREFIX = 'program-v1:';
const MIGRATION_MARKER_KEY = 'migration-v3-complete';
const LEGACY_V2_KEY = 'v2';
const SQL_WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm';

let SQL = null;
let db = null;
let catalogDb = null;
let currentProgramId = null;

function getDb() {
  if (!db) throw new Error('No program active. Select a program first.');
  return db;
}

function getCatalogDb() {
  if (!catalogDb) throw new Error('Catalog not initialized.');
  return catalogDb;
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs({
    locateFile: () => SQL_WASM_URL,
  });
  window.__sqlJs = SQL;
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

async function idbGet(key) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbPut(key, value) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbDelete(key) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbBatch(ops) {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    for (const op of ops) {
      if (op.type === 'put') {
        store.put(op.value, op.key);
      } else if (op.type === 'delete') {
        store.delete(op.key);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

function programKey(programId) {
  return `${PROGRAM_KEY_PREFIX}${programId}`;
}

// ── Catalog operations ──

function catalogQueryAll(sql, params = []) {
  const results = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function catalogQueryOne(sql, params = []) {
  const results = catalogQueryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function catalogExecSQL(sql, params = []) {
  getCatalogDb().run(sql, params);
}

function catalogLastInsertRowId() {
  const result = getCatalogDb().exec('SELECT last_insert_rowid()');
  return result[0].values[0][0];
}

async function saveCatalog() {
  await idbPut(CATALOG_KEY, getCatalogDb().export());
}

// ── Program store query helpers ──

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

// ── Save with debounce ──

let autoSaveTimer = null;
function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      if (currentProgramId != null && db) {
        await idbPut(programKey(currentProgramId), db.export());
      }
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, 300);
}

function execSQL(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  scheduleAutoSave();
}

async function saveNow() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (currentProgramId != null && db) {
    await idbPut(programKey(currentProgramId), db.export());
  }
}

// ── Validation ──

function validateProgramStructure(database) {
  try {
    const ver = database.exec('SELECT MAX(version) FROM schema_version');
    const version = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : 0;
    if (version !== SCHEMA_VERSION) return false;
  } catch {
    return false;
  }

  const requiredTables = {
    mesocycles: ['id', 'name', 'microcycle_length', 'start_date', 'notes', 'sort_order'],
    workouts: ['id', 'mesocycle_id', 'name', 'day_offset', 'notes', 'sort_order'],
    exercise_groups: ['id', 'name', 'notes'],
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

function validateLegacyStructure(database) {
  const requiredTables = {
    programs: ['id', 'name', 'created_at', 'notes'],
    mesocycles: ['id', 'program_id', 'name', 'microcycle_length', 'start_date', 'notes', 'sort_order'],
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

// ── Program store management ──

async function openProgramStore(programId, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const saved = await idbGet(programKey(programId));
    if (saved) {
      const sql = await loadSqlJs();
      const progDb = new sql.Database(saved);
      progDb.run('PRAGMA foreign_keys = ON');
      return progDb;
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return null;
}

async function saveProgramStore(programId, database) {
  const d = database || db;
  if (!d) return;
  await idbPut(programKey(programId), d.export());
}

async function deleteProgramStore(programId) {
  await idbDelete(programKey(programId));
}

// ── Serialized activation/deactivation ──
let activationLock = Promise.resolve();

async function activateProgram(programId, { skipSave = false } = {}) {
  activationLock = activationLock.catch(() => {}); // recover from previous failures
  const op = activationLock.then(async () => {
    if (db) {
      if (!skipSave) {
        await saveNow();
      }
      db.close();
      db = null;
      currentProgramId = null;
    }
    if (programId == null) return;

    const progDb = await openProgramStore(programId);
    if (!progDb) throw new Error(`Program store not found for program ${programId}`);

    const ver = progDb.exec('SELECT MAX(version) FROM schema_version');
    const version = ver.length > 0 && ver[0].values.length > 0 ? ver[0].values[0][0] : 0;
    if (version !== SCHEMA_VERSION) {
      progDb.close();
      throw new Error(`Program store schema version mismatch: expected ${SCHEMA_VERSION}, got ${version}`);
    }

    if (!validateProgramStructure(progDb)) {
      progDb.close();
      throw new Error('Program store is missing required tables/columns.');
    }

    db = progDb;
    currentProgramId = programId;
  });
  activationLock = op.catch(() => {}); // keep queue alive after rejection
  return op;
}

async function deactivateProgram() {
  activationLock = activationLock.catch(() => {}); // recover from previous failures
  const op = activationLock.then(async () => {
    if (db) {
      await saveNow();
      db.close();
      db = null;
      currentProgramId = null;
    }
  });
  activationLock = op.catch(() => {}); // keep queue alive after rejection
  return op;
}

// ── Catalog program store creation ──

function createProgramStore() {
  const s = new SQL.Database();
  s.run(createProgramSQL);
  return s;
}

async function saveNewProgramStore(programId, database) {
  await idbPut(programKey(programId), database.export());
}

// ── Legacy migration ──

async function migrateLegacyData(legacyDb) {
  const sql = await loadSqlJs();

  const programs = readLegacyPrograms(legacyDb);

  const catalog = new sql.Database();
  catalog.run(createCatalogSQL);

  if (programs.length === 0) {
    if (catalogDb) catalogDb.close();
    catalogDb = catalog;
    await saveCatalog();
    await idbPut(MIGRATION_MARKER_KEY, 1);
    return;
  }

  const programStores = [];

  for (const prog of programs) {
    const progDb = new sql.Database();
    progDb.run(createProgramSQL);

    // Copy mesocycles
    const mesos = readAll(legacyDb, `SELECT * FROM mesocycles WHERE program_id = ?`, [prog.id]);
    const mesoIds = [];
    for (const m of mesos) {
      progDb.run(
        'INSERT INTO mesocycles (id, name, microcycle_length, start_date, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [m.id, m.name, m.microcycle_length, m.start_date, m.notes, m.sort_order]
      );
      mesoIds.push(m.id);
    }

    // Copy workouts for these mesocycles
    let allWorkoutIds = [];
    if (mesoIds.length > 0) {
      for (const mesoId of mesoIds) {
        const workouts = readAll(legacyDb, 'SELECT * FROM workouts WHERE mesocycle_id = ?', [mesoId]);
        for (const w of workouts) {
          progDb.run(
            'INSERT INTO workouts (id, mesocycle_id, name, day_offset, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [w.id, w.mesocycle_id, w.name, w.day_offset, w.notes, w.sort_order]
          );
          allWorkoutIds.push(w.id);
        }
      }
    }

    // Copy exercise_groups
    const groups = readAll(legacyDb, 'SELECT * FROM exercise_groups WHERE program_id = ?', [prog.id]);
    const groupIds = [];
    for (const g of groups) {
      progDb.run(
        'INSERT INTO exercise_groups (id, name, notes) VALUES (?, ?, ?)',
        [g.id, g.name, g.notes]
      );
      groupIds.push(g.id);
    }

    // Copy exercises
    let allExIds = [];
    if (groupIds.length > 0) {
      for (const gid of groupIds) {
        const exercises = readAll(legacyDb, 'SELECT * FROM exercises WHERE exercise_group_id = ?', [gid]);
        for (const e of exercises) {
          progDb.run(
            'INSERT INTO exercises (id, exercise_group_id, name, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)',
            [e.id, e.exercise_group_id, e.name, e.tutorial_url, e.notes]
          );
          allExIds.push(e.id);
        }
      }

      // Copy exercise_variations
      if (allExIds.length > 0) {
        for (const exId of allExIds) {
          const vars = readAll(legacyDb, 'SELECT * FROM exercise_variations WHERE exercise_id = ?', [exId]);
          for (const v of vars) {
            progDb.run(
              'INSERT INTO exercise_variations (id, exercise_id, name, is_primary, tutorial_url, notes) VALUES (?, ?, ?, ?, ?, ?)',
              [v.id, v.exercise_id, v.name, v.is_primary, v.tutorial_url, v.notes]
            );
          }
        }
      }
    }

    // Copy workout_sets (only where both workout and exercise are in this program)
    if (allWorkoutIds.length > 0 && allExIds.length > 0) {
      for (const wid of allWorkoutIds) {
        const sets = readAll(legacyDb, 'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id IN (' + allExIds.map(() => '?').join(',') + ')', [wid, ...allExIds]);
        for (const s of sets) {
          progDb.run(
            'INSERT INTO workout_sets (id, workout_id, exercise_id, exercise_variation_id, exercise_order, set_number, set_type, reps, weight, rir, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [s.id, s.workout_id, s.exercise_id, s.exercise_variation_id ?? null, s.exercise_order, s.set_number, s.set_type, s.reps ?? null, s.weight ?? null, s.rir ?? null, s.notes]
          );
        }
      }
    }

    if (!validateProgramStructure(progDb)) {
      progDb.close();
      throw new Error(`Generated program store for "${prog.name}" failed validation.`);
    }

    programStores.push({ id: prog.id, db: progDb });

    // Insert into catalog
    catalog.run(
      'INSERT INTO programs (id, name, notes, created_at) VALUES (?, ?, ?, ?)',
      [prog.id, prog.name, prog.notes, prog.created_at]
    );
  }

  // Atomically persist everything in one IDB transaction
  const idb = await openIndexedDB();
  await new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(catalog.export(), CATALOG_KEY);
    for (const ps of programStores) {
      store.put(ps.db.export(), programKey(ps.id));
    }
    store.put(1, MIGRATION_MARKER_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });

  // Only delete legacy after successful write
  await idbDelete(LEGACY_V2_KEY);

  // Clean up program DBs
  for (const ps of programStores) {
    ps.db.close();
  }

  // Set catalogDb
  if (catalogDb) catalogDb.close();
  catalogDb = catalog;
}

function readLegacyPrograms(legacyDb) {
  const rows = [];
  const stmt = legacyDb.prepare('SELECT * FROM programs');
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function readAll(db, sql, params = []) {
  const rows = [];
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// ── Init ──

async function initDatabase() {
  const sql = await loadSqlJs();

  const migrationDone = await idbGet(MIGRATION_MARKER_KEY);

  if (!migrationDone) {
    const legacyData = await idbGet(LEGACY_V2_KEY);
    if (legacyData) {
      const legacyDb = new sql.Database(legacyData);
      if (validateLegacyStructure(legacyDb)) {
        try {
          await migrateLegacyData(legacyDb);
          legacyDb.close();
        } catch (e) {
          legacyDb.close();
          throw new Error(`Legacy migration failed: ${e.message}. Original data preserved.`);
        }
      } else {
        legacyDb.close();
        throw new Error('Legacy database has invalid structure. Migration cannot proceed.');
      }
    } else {
      catalogDb = new sql.Database();
      catalogDb.run(createCatalogSQL);
      await saveCatalog();
      await idbPut(MIGRATION_MARKER_KEY, 1);
    }
  } else {
    const catalogData = await idbGet(CATALOG_KEY);
    if (catalogData) {
      catalogDb = new sql.Database(catalogData);
      catalogDb.run('PRAGMA foreign_keys = ON');
    } else {
      catalogDb = new sql.Database();
      catalogDb.run(createCatalogSQL);
      await saveCatalog();
    }
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveNow().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    saveNow().catch(() => {});
  });
}

// ── Program backup/restore ──

async function exportProgramBackup(programId) {
  const progData = await idbGet(programKey(programId));
  if (!progData) throw new Error(`No data found for program ${programId}`);

  const program = catalogQueryOne('SELECT * FROM programs WHERE id = ?', [programId]);
  if (!program) throw new Error(`Program ${programId} not found in catalog.`);

  const sql = await loadSqlJs();
  const backupDb = new sql.Database(progData);
  backupDb.run('PRAGMA foreign_keys = ON');

  backupDb.run(`
    CREATE TABLE IF NOT EXISTS backup_metadata (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const meta = [
    ['program_name', program.name],
    ['program_notes', program.notes || ''],
    ['program_created_at', program.created_at],
    ['format_version', String(SCHEMA_VERSION)],
    ['backup_type', 'program-backup'],
    ['source_program_id', String(programId)],
    ['exported_at', new Date().toISOString()],
  ];
  for (const [k, v] of meta) {
    backupDb.run('INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?, ?)', [k, v]);
  }

  const exported = backupDb.export();
  backupDb.close();
  return exported;
}

async function importProgramBackup(programId, buffer) {
  const sql = await loadSqlJs();

  const arr = new Uint8Array(buffer);
  const header = new TextDecoder().decode(arr.slice(0, 16));
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('Not a valid SQLite database file.');
  }

  const importDb = new sql.Database(arr);
  importDb.run('PRAGMA foreign_keys = ON');

  if (!validateProgramStructure(importDb)) {
    importDb.close();
    throw new Error('Backup file is missing required program tables or columns.');
  }

  const metaRows = importDb.exec('SELECT key, value FROM backup_metadata');
  const meta = {};
  if (metaRows.length > 0 && metaRows[0].values.length > 0) {
    for (const [k, v] of metaRows[0].values) {
      meta[k] = v;
    }
  }

  if (meta.backup_type !== 'program-backup') {
    importDb.close();
    throw new Error('File is not a valid program backup.');
  }

  if (meta.format_version !== String(SCHEMA_VERSION)) {
    importDb.close();
    throw new Error(`Backup format version ${meta.format_version || 'unknown'} is not compatible (expected ${SCHEMA_VERSION}).`);
  }

  importDb.run('DROP TABLE IF EXISTS backup_metadata');

  const data = importDb.export();
  importDb.close();

  if (meta.program_name) {
    const existing = catalogQueryOne('SELECT id FROM programs WHERE name = ? AND id != ?', [meta.program_name, programId]);
    if (existing) {
      throw new Error(`Cannot restore: program name "${meta.program_name}" conflicts with an existing program.`);
    }
  }

  // Build updated catalog bytes
  let catalogData = null;
  if (meta.program_name) {
    const catalogSnapshot = new sql.Database(getCatalogDb().export());
    catalogSnapshot.run(
      'UPDATE programs SET name = ?, notes = ?, created_at = ? WHERE id = ?',
      [meta.program_name, meta.program_notes || null, meta.program_created_at || new Date().toISOString(), programId]
    );
    catalogData = catalogSnapshot.export();
    catalogSnapshot.close();
  }

  // Atomic write: program store + catalog in a single IDB transaction
  const idb = await openIndexedDB();
  await new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data, programKey(programId));
    if (catalogData) {
      store.put(catalogData, CATALOG_KEY);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });

  // Update in-memory catalog only after successful write
  if (meta.program_name) {
    catalogExecSQL(
      'UPDATE programs SET name = ?, notes = ?, created_at = ? WHERE id = ?',
      [meta.program_name, meta.program_notes || null, meta.program_created_at || new Date().toISOString(), programId]
    );
  }

  return meta;
}

async function validateProgramBackup(buffer) {
  const sql = await loadSqlJs();

  const arr = new Uint8Array(buffer);
  const header = new TextDecoder().decode(arr.slice(0, 16));
  if (!header.startsWith('SQLite format 3')) {
    return { valid: false, error: 'Not a valid SQLite database file.' };
  }

  let checkDb;
  try {
    checkDb = new sql.Database(arr);
  } catch {
    return { valid: false, error: 'File appears to be corrupted.' };
  }

  if (!validateProgramStructure(checkDb)) {
    checkDb.close();
    return { valid: false, error: 'File is missing required program tables or columns.' };
  }

  const metaRows = checkDb.exec('SELECT key, value FROM backup_metadata');
  const meta = {};
  if (metaRows.length > 0 && metaRows[0].values.length > 0) {
    for (const [k, v] of metaRows[0].values) {
      meta[k] = v;
    }
  }

  checkDb.close();

  if (meta.backup_type !== 'program-backup') {
    return { valid: false, error: 'File is not a valid program backup.' };
  }

  if (meta.format_version !== String(SCHEMA_VERSION)) {
    return { valid: false, error: `Backup format version ${meta.format_version || 'unknown'} is not compatible (expected ${SCHEMA_VERSION}).` };
  }

  return { valid: true, meta };
}

// ── Export helpers for ProgramDataPage ──

function getDatabaseSize() {
  if (db) return db.export().length;
  return 0;
}

async function replaceCatalogDb(newBytes) {
  if (catalogDb) catalogDb.close();
  const sql = await loadSqlJs();
  catalogDb = new sql.Database(newBytes);
  catalogDb.run('PRAGMA foreign_keys = ON');
}

export {
  initDatabase,
  getDb,
  getCatalogDb,
  activateProgram,
  deactivateProgram,
  currentProgramId,
  saveNow,

  catalogQueryAll,
  catalogQueryOne,
  catalogExecSQL,
  catalogLastInsertRowId,
  saveCatalog,

  queryAll,
  queryOne,
  queryValue,
  execSQL,
  lastInsertRowId,
  scheduleAutoSave,

  openProgramStore,
  saveProgramStore,
  deleteProgramStore,
  programKey,
  createProgramStore,
  saveNewProgramStore,
  replaceCatalogDb,

  validateProgramStructure,
  validateLegacyStructure,

  exportProgramBackup,
  importProgramBackup,
  validateProgramBackup,

  getDatabaseSize,
  SCHEMA_VERSION,
};
