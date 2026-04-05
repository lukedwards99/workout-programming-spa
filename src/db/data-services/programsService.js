/**
 * Data service for the programs table.
 * Each function accepts a sql.js Database instance as its first argument.
 */

function rowsToObjects(result) {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

const SELECT_FIELDS = 'id, name, notes';

export function listPrograms(db) {
  const result = db.exec(`SELECT ${SELECT_FIELDS} FROM programs ORDER BY id`);
  return rowsToObjects(result);
}

export function getProgram(db, id) {
  const stmt = db.prepare(`SELECT ${SELECT_FIELDS} FROM programs WHERE id = :id`);
  stmt.bind({ ':id': id });
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

export function createProgram(db, input) {
  const { name, notes = null } = input;
  db.run(
    'INSERT INTO programs (name, notes) VALUES (?, ?)',
    [name, notes]
  );
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  return getProgram(db, id);
}

export function updateProgram(db, id, input) {
  const { name, notes = null } = input;
  db.run(
    'UPDATE programs SET name = ?, notes = ? WHERE id = ?',
    [name, notes, id]
  );
  return getProgram(db, id);
}

export function deleteProgram(db, id) {
  db.run('DELETE FROM programs WHERE id = ?', [id]);
}
