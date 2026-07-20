// Dev and prod are paths on the same github.io origin, so IndexedDB must be
// namespaced explicitly to prevent development builds from modifying prod data.
export const IDB_NAME = import.meta.env.VITE_APP_ENV === 'development'
  ? 'workout-programming-v5-dev'
  : 'workout-programming-v5';
export const IDB_STORE = 'databases';
export const CATALOG_KEY = 'catalog-v1';
export const PROGRAM_KEY_PREFIX = 'program-v1:';

let idbPromise: Promise<IDBDatabase> | null = null;

export type IDBStoredValue = Uint8Array | number | string | FileSystemDirectoryHandle;

export function openIndexedDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
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
  idbPromise.catch(() => { idbPromise = null; });
  return idbPromise;
}

export async function idbGet<T extends IDBStoredValue = IDBStoredValue>(key: string): Promise<T | undefined> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = (e) => resolve((e.target as IDBRequest<T>).result);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function idbPut(key: string, value: IDBStoredValue): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  const idb = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export type IDBTxOp =
  | { type: 'put'; key: string; value: IDBStoredValue }
  | { type: 'delete'; key: string };

export async function runTransaction(ops: IDBTxOp[]): Promise<void> {
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
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

export function programKey(programId: number): string {
  return `${PROGRAM_KEY_PREFIX}${programId}`;
}
