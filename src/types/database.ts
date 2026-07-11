import type { BackupMetadata, BackupValidationResult } from './api';

// ── SQL value union ──

export type SqlValue = number | string | Uint8Array | null;

// ── Row shape returned by sql.js getAsObject ──

export type SqlRow = Record<string, SqlValue>;

// ── SQL parameter collections ──

export type SqlParams = SqlValue[];

// ── IDB key/value ──

export type IDBValue = Uint8Array | number;

// ── IDB batch operation ──

export interface IDBPutOp {
  type: 'put';
  key: string;
  value: IDBValue;
}

export interface IDBDeleteOp {
  type: 'delete';
  key: string;
}

export type IDBBatchOp = IDBPutOp | IDBDeleteOp;

// ── Database service public interface ──

export interface DatabaseService {
  initDatabase: () => Promise<void>;
  getDb: () => import('sql.js').Database;
  getCatalogDb: () => import('sql.js').Database;
  activateProgram: (programId: number | null, opts?: { skipSave?: boolean }) => Promise<void>;
  deactivateProgram: () => Promise<void>;
  readonly currentProgramId: number | null;
  saveNow: () => Promise<void>;

  catalogQueryAll: (sql: string, params?: SqlParams) => SqlRow[];
  catalogQueryOne: (sql: string, params?: SqlParams) => SqlRow | null;
  catalogExecSQL: (sql: string, params?: SqlParams) => void;
  catalogLastInsertRowId: () => number;
  saveCatalog: () => Promise<void>;

  queryAll: (sql: string, params?: SqlParams) => SqlRow[];
  queryOne: (sql: string, params?: SqlParams) => SqlRow | null;
  queryValue: (sql: string, params?: SqlParams) => SqlValue;
  execSQL: (sql: string, params?: SqlParams) => void;
  lastInsertRowId: () => number;
  scheduleAutoSave: () => void;

  openProgramStore: (programId: number, retries?: number) => Promise<import('sql.js').Database | null>;
  saveProgramStore: (programId: number, database?: import('sql.js').Database) => Promise<void>;
  deleteProgramStore: (programId: number) => Promise<void>;
  programKey: (programId: number) => string;
  createProgramStore: () => import('sql.js').Database;
  saveNewProgramStore: (programId: number, database: import('sql.js').Database) => Promise<void>;
  replaceCatalogDb: (newBytes: Uint8Array) => Promise<void>;

  validateProgramStructure: (database: import('sql.js').Database) => boolean;
  validateLegacyStructure: (database: import('sql.js').Database) => boolean;

  exportProgramBackup: (programId: number) => Promise<Uint8Array>;
  importProgramBackup: (programId: number, buffer: ArrayBuffer) => Promise<BackupMetadata>;
  validateProgramBackup: (buffer: ArrayBuffer) => Promise<BackupValidationResult>;

  getDatabaseSize: () => number;
  SCHEMA_VERSION: number;
}
