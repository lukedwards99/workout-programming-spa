import type { Program } from '../types/domain';
import type { CreateProgramInput, UpdateProgramInput } from '../types/api';
import type { SqlRow } from '../types/database';
import {
  catalogQueryAll, catalogQueryOne,
  createProgramStore, programKey, getCatalogDb, replaceCatalogDb,
} from '../db/databaseService';

const IDB_NAME = 'workout-programming-v4';
const IDB_STORE = 'databases';
const CATALOG_KEY = 'catalog-v1';

async function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function importSqlJs() {
  const initSqlJs = (await import('sql.js')).default;
  return initSqlJs({
    locateFile: () => 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm',
  });
}

async function cloneCatalog() {
  const SQL = await importSqlJs();
  const copy = new SQL.Database(getCatalogDb().export());
  copy.run('PRAGMA foreign_keys = ON');
  return copy;
}

function asProgram(row: SqlRow): Program {
  return {
    id: row.id as number,
    name: row.name as string,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  };
}

export const programsApi = {
  list(): Program[] {
    return catalogQueryAll('SELECT p.* FROM programs p ORDER BY p.created_at DESC').map(asProgram);
  },
  get(id: number): Program | null {
    const row = catalogQueryOne('SELECT * FROM programs WHERE id = ?', [id]);
    return row ? asProgram(row) : null;
  },
  async create({ name, notes }: CreateProgramInput): Promise<Program> {
    const store = createProgramStore();
    const storeData = store.export();
    store.close();

    const clone = await cloneCatalog();
    clone.run('INSERT INTO programs (name, notes) VALUES (?, ?)', [name, notes || null]);
    const progRow = clone.exec('SELECT * FROM programs WHERE id = last_insert_rowid()');
    const prog: Program | null = progRow.length > 0 ? {
      id: progRow[0].values[0][0] as number,
      name: progRow[0].values[0][1] as string,
      notes: progRow[0].values[0][2] as string | null,
      created_at: progRow[0].values[0][3] as string,
    } : null;
    const catalogData = clone.export();
    clone.close();

    if (!prog) throw new Error('Failed to create program record.');

    const idb = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      objStore.put(storeData, programKey(prog.id));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    await replaceCatalogDb(catalogData);

    return prog;
  },
  async update(id: number, { name, notes }: UpdateProgramInput): Promise<Program | null> {
    const clone = await cloneCatalog();
    clone.run('UPDATE programs SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    const catalogData = clone.export();
    clone.close();

    const idb = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    await replaceCatalogDb(catalogData);
    return this.get(id);
  },
  async delete(id: number): Promise<void> {
    const clone = await cloneCatalog();
    clone.run('DELETE FROM programs WHERE id = ?', [id]);
    const catalogData = clone.export();
    clone.close();

    const idb = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      objStore.delete(programKey(id));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });

    await replaceCatalogDb(catalogData);
  },
};
