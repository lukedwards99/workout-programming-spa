import {
  catalogQueryAll, catalogQueryOne,
  createProgramStore, programKey, getCatalogDb, replaceCatalogDb,
} from '../db/databaseService';

const IDB_NAME = 'workout-programming-v3';
const IDB_STORE = 'databases';
const CATALOG_KEY = 'catalog-v1';

async function idbOpen() {
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

export const programsApi = {
  list() {
    return catalogQueryAll('SELECT p.* FROM programs p ORDER BY p.created_at DESC');
  },
  get(id) {
    return catalogQueryOne('SELECT * FROM programs WHERE id = ?', [id]);
  },
  async create({ name, notes }) {
    const store = createProgramStore();
    const storeData = store.export();
    store.close();

    const clone = await cloneCatalog();
    clone.run('INSERT INTO programs (name, notes) VALUES (?, ?)', [name, notes || null]);
    const progRow = clone.exec('SELECT * FROM programs WHERE id = last_insert_rowid()');
    const prog = progRow.length > 0 ? {
      id: progRow[0].values[0][0],
      name: progRow[0].values[0][1],
      notes: progRow[0].values[0][2],
      created_at: progRow[0].values[0][3],
    } : null;
    const catalogData = clone.export();
    clone.close();

    if (!prog) throw new Error('Failed to create program record.');

    const idb = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      objStore.put(storeData, programKey(prog.id));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    await replaceCatalogDb(catalogData);

    return prog;
  },
  async update(id, { name, notes }) {
    const clone = await cloneCatalog();
    clone.run('UPDATE programs SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    const catalogData = clone.export();
    clone.close();

    const idb = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    await replaceCatalogDb(catalogData);
    return this.get(id);
  },
  async delete(id) {
    const clone = await cloneCatalog();
    clone.run('DELETE FROM programs WHERE id = ?', [id]);
    const catalogData = clone.export();
    clone.close();

    const idb = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const objStore = tx.objectStore(IDB_STORE);
      objStore.put(catalogData, CATALOG_KEY);
      objStore.delete(programKey(id));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    await replaceCatalogDb(catalogData);
  },
};
