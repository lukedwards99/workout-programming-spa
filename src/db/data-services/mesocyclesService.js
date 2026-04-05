/**
 * Data service for the mesocycles table.
 * Each function accepts a sql.js Database instance as its first argument.
 */

function rowsToObjects(result) {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

const SELECT_FIELDS = 'id, program_id, program_name, start_date, microcycle_length, notes';

export function listMesocycles(db, programId) {
  const result = programId != null
    ? db.exec(`SELECT ${SELECT_FIELDS} FROM mesocycles WHERE program_id = ${Number(programId)} ORDER BY id`)
    : db.exec(`SELECT ${SELECT_FIELDS} FROM mesocycles ORDER BY id`);
  return rowsToObjects(result);
}

export function getMesocycle(db, id) {
  const stmt = db.prepare(`SELECT ${SELECT_FIELDS} FROM mesocycles WHERE id = :id`);
  stmt.bind({ ':id': id });
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

export function createMesocycle(db, input) {
  const { program_id, program_name, start_date, microcycle_length, notes = null } = input;
  db.run(
    'INSERT INTO mesocycles (program_id, program_name, start_date, microcycle_length, notes) VALUES (?, ?, ?, ?, ?)',
    [program_id, program_name, start_date, microcycle_length, notes]
  );
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  return getMesocycle(db, id);
}

export function updateMesocycle(db, id, input) {
  const { program_id, program_name, start_date, microcycle_length, notes = null } = input;
  db.run(
    'UPDATE mesocycles SET program_id = ?, program_name = ?, start_date = ?, microcycle_length = ?, notes = ? WHERE id = ?',
    [program_id, program_name, start_date, microcycle_length, notes, id]
  );
  return getMesocycle(db, id);
}

export function deleteMesocycle(db, id) {
  db.run('DELETE FROM mesocycles WHERE id = ?', [id]);
}
