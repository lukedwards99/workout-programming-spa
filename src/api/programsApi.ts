import type { Program } from '../types/domain';
import type { CreateProgramInput, UpdateProgramInput } from '../types/api';
import type { SqlRow } from '../types/database';
import {
  catalogQueryAll, catalogQueryOne,
  createProgramStore, getCatalogDb, replaceCatalogDb, programKey,
} from '../db/databaseService';
import { CATALOG_KEY, runTransaction } from '../db/indexedDb';
import { initSqlJs } from '../db/sqlRuntime';

async function cloneCatalog() {
  const SQL = await initSqlJs();
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

    await runTransaction([
      { type: 'put', key: CATALOG_KEY, value: catalogData },
      { type: 'put', key: programKey(prog.id), value: storeData },
    ]);

    await replaceCatalogDb(catalogData);

    return prog;
  },
  async update(id: number, { name, notes }: UpdateProgramInput): Promise<Program | null> {
    const clone = await cloneCatalog();
    clone.run('UPDATE programs SET name = ?, notes = ? WHERE id = ?', [name, notes || null, id]);
    const catalogData = clone.export();
    clone.close();

    await runTransaction([
      { type: 'put', key: CATALOG_KEY, value: catalogData },
    ]);

    await replaceCatalogDb(catalogData);
    return this.get(id);
  },
  async delete(id: number): Promise<void> {
    const clone = await cloneCatalog();
    clone.run('DELETE FROM programs WHERE id = ?', [id]);
    const catalogData = clone.export();
    clone.close();

    await runTransaction([
      { type: 'put', key: CATALOG_KEY, value: catalogData },
      { type: 'delete', key: programKey(id) },
    ]);

    await replaceCatalogDb(catalogData);
  },
};
