import type { SqlValue, SqlRow, SqlParams } from '../types/database';
import type { BackupMetadata, BackupValidationResult } from '../types/api';
import { createCatalogSQL, createProgramSQL, SCHEMA_VERSION } from './ddl';
import { idbGet, idbPut, idbDelete, runTransaction, programKey } from './indexedDb';
import { CATALOG_KEY } from './indexedDb';
import { initSqlJs, getSQL } from './sqlRuntime';

const MIGRATION_MARKER_KEY = 'migration-v5-complete';

let db: import('sql.js').Database | null = null;
let catalogDb: import('sql.js').Database | null = null;
let currentProgramId: number | null = null;

function getDb(): import('sql.js').Database {
  if (!db) throw new Error('No program active. Select a program first.');
  return db;
}

function getCatalogDb(): import('sql.js').Database {
  if (!catalogDb) throw new Error('Catalog not initialized.');
  return catalogDb;
}

// ── Catalog operations ──

function catalogQueryAll(sql: string, params: SqlParams = []): SqlRow[] {
  const results: SqlRow[] = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function catalogQueryOne(sql: string, params: SqlParams = []): SqlRow | null {
  const results = catalogQueryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function catalogExecSQL(sql: string, params: SqlParams = []): void {
  getCatalogDb().run(sql, params);
}

function catalogLastInsertRowId(): number {
  const result = getCatalogDb().exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

async function saveCatalog(): Promise<void> {
  await idbPut(CATALOG_KEY, getCatalogDb().export());
}

// ── Program store query helpers ──

function queryAll(sql: string, params: SqlParams = []): SqlRow[] {
  const results: SqlRow[] = [];
  const stmt = getDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: SqlParams = []): SqlRow | null {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function queryValue(sql: string, params: SqlParams = []): SqlValue {
  const result = getDb().exec(sql, params);
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0].length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

function lastInsertRowId(): number {
  const result = getDb().exec('SELECT last_insert_rowid()');
  return result[0].values[0][0] as number;
}

// ── Save with debounce ──

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoSave(): void {
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

function execSQL(sql: string, params: SqlParams = []): void {
  const d = getDb();
  d.run(sql, params);
  scheduleAutoSave();
}

async function saveNow(): Promise<void> {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (currentProgramId != null && db) {
    await idbPut(programKey(currentProgramId), db.export());
  }
}

// ── Validation ──

function validateProgramStructure(database: import('sql.js').Database): boolean {
  try {
    const ver = database.exec('SELECT MAX(version) FROM schema_version');
    const version = ver.length > 0 && ver[0].values.length > 0 ? (ver[0].values[0][0] as number) : 0;
    if (version !== SCHEMA_VERSION) return false;
  } catch {
    return false;
  }

  const requiredTables: Record<string, string[]> = {
    mesocycles: ['id', 'name', 'mesocycle_length', 'start_date', 'notes', 'sort_order'],
    workouts: ['id', 'mesocycle_id', 'name', 'day_offset', 'notes', 'sort_order'],
    exercise_groups: ['id', 'name', 'notes'],
    exercises: ['id', 'exercise_group_id', 'name', 'tutorial_url', 'notes'],
    exercise_variations: ['id', 'exercise_id', 'name', 'is_primary', 'tutorial_url', 'notes'],
    workout_sets: ['id', 'workout_id', 'exercise_id', 'exercise_variation_id', 'exercise_order', 'set_number', 'set_type', 'planned_reps', 'actual_reps', 'weight', 'rir', 'notes'],
  };
  for (const [table, columns] of Object.entries(requiredTables)) {
    try {
      const info = database.exec(`PRAGMA table_info(${table})`);
      if (!info.length || !info[0].values.length) return false;
      const existingColumns = info[0].values.map((r: SqlValue[]) => r[1] as string);
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

async function openProgramStore(programId: number, retries: number = 5): Promise<import('sql.js').Database | null> {
  for (let i = 0; i < retries; i++) {
    const saved = await idbGet(programKey(programId));
    if (saved && saved instanceof Uint8Array) {
      const sql = await initSqlJs();
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

async function saveProgramStore(programId: number, database?: import('sql.js').Database): Promise<void> {
  const d = database || db;
  if (!d) return;
  await idbPut(programKey(programId), d.export());
}

async function deleteProgramStore(programId: number): Promise<void> {
  await idbDelete(programKey(programId));
}

// ── Serialized activation/deactivation ──
let activationLock: Promise<void> = Promise.resolve();

async function activateProgram(programId: number | null, { skipSave = false }: { skipSave?: boolean } = {}): Promise<void> {
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
    const version = ver.length > 0 && ver[0].values.length > 0 ? (ver[0].values[0][0] as number) : 0;
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
  activationLock = op.catch(() => {}) as Promise<void>;
  return op;
}

async function deactivateProgram(): Promise<void> {
  activationLock = activationLock.catch(() => {}); // recover from previous failures
  const op = activationLock.then(async () => {
    if (db) {
      await saveNow();
      db.close();
      db = null;
      currentProgramId = null;
    }
  });
  activationLock = op.catch(() => {}) as Promise<void>;
  return op;
}

// ── Catalog program store creation ──

function createProgramStore(): import('sql.js').Database {
  const SQL = getSQL();
  if (!SQL) throw new Error('SQL.js not initialized.');
  const s = new SQL.Database();
  s.run(createProgramSQL);
  return s;
}

async function saveNewProgramStore(programId: number, database: import('sql.js').Database): Promise<void> {
  await idbPut(programKey(programId), database.export());
}

// ── Init ──

async function initDatabase(): Promise<void> {
  const sql = await initSqlJs();

  const migrationDone = await idbGet(MIGRATION_MARKER_KEY);

  if (!migrationDone) {
    catalogDb = new sql.Database();
    catalogDb.run(createCatalogSQL);
    await saveCatalog();
    await idbPut(MIGRATION_MARKER_KEY, 1);
  } else {
    const catalogData = await idbGet(CATALOG_KEY);
    if (catalogData && catalogData instanceof Uint8Array) {
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

interface FolderBackupExportMetadata {
  id: string;
  filename: string;
}

async function exportProgramBackup(
  programId: number,
  folderBackup?: FolderBackupExportMetadata,
): Promise<Uint8Array> {
  const progData = await idbGet(programKey(programId));
  if (!progData || !(progData instanceof Uint8Array)) throw new Error(`No data found for program ${programId}`);

  const program = catalogQueryOne('SELECT * FROM programs WHERE id = ?', [programId]);
  if (!program) throw new Error(`Program ${programId} not found in catalog.`);

  const sql = await initSqlJs();
  const backupDb = new sql.Database(progData);
  backupDb.run('PRAGMA foreign_keys = ON');

  backupDb.run(`
    CREATE TABLE IF NOT EXISTS backup_metadata (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const meta: [string, string][] = [
    ['program_name', String(program.name)],
    ['program_notes', String(program.notes || '')],
    ['program_created_at', String(program.created_at)],
    ['format_version', String(SCHEMA_VERSION)],
    ['backup_type', 'program-backup'],
    ['source_program_id', String(programId)],
    ['exported_at', new Date().toISOString()],
  ];
  if (folderBackup) {
    meta.push(['folder_backup_id', folderBackup.id]);
    meta.push(['folder_backup_filename', folderBackup.filename]);
  }
  for (const [k, v] of meta) {
    backupDb.run('INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?, ?)', [k, v]);
  }

  const exported = backupDb.export();
  backupDb.close();
  return exported;
}

async function importProgramBackup(programId: number, buffer: ArrayBuffer): Promise<BackupMetadata> {
  const sql = await initSqlJs();

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
  const meta: BackupMetadata = {};
  if (metaRows.length > 0 && metaRows[0].values.length > 0) {
    for (const [k, v] of metaRows[0].values) {
      meta[k as string] = v as string;
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

  let catalogData: Uint8Array | null = null;
  if (meta.program_name) {
    const catalogSnapshot = new sql.Database(getCatalogDb().export());
    catalogSnapshot.run(
      'UPDATE programs SET name = ?, notes = ?, created_at = ? WHERE id = ?',
      [meta.program_name, meta.program_notes || null, meta.program_created_at || new Date().toISOString(), programId]
    );
    catalogData = catalogSnapshot.export();
    catalogSnapshot.close();
  }

  const ops: Array<{ type: 'put'; key: string; value: Uint8Array }> = [
    { type: 'put', key: programKey(programId), value: data },
  ];
  if (catalogData) {
    ops.push({ type: 'put', key: CATALOG_KEY, value: catalogData });
  }
  await runTransaction(ops);

  if (meta.program_name) {
    catalogExecSQL(
      'UPDATE programs SET name = ?, notes = ?, created_at = ? WHERE id = ?',
      [meta.program_name, meta.program_notes || null, meta.program_created_at || new Date().toISOString(), programId]
    );
  }

  return meta;
}

async function validateProgramBackup(buffer: ArrayBuffer): Promise<BackupValidationResult> {
  const sql = await initSqlJs();

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
  const meta: BackupMetadata = {};
  if (metaRows.length > 0 && metaRows[0].values.length > 0) {
    for (const [k, v] of metaRows[0].values) {
      meta[k as string] = v as string;
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

function getDatabaseSize(): number {
  if (db) return db.export().length;
  return 0;
}

async function replaceCatalogDb(newBytes: Uint8Array): Promise<void> {
  if (catalogDb) catalogDb.close();
  const sql = await initSqlJs();
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

  exportProgramBackup,
  importProgramBackup,
  validateProgramBackup,

  getDatabaseSize,
  SCHEMA_VERSION,
};
