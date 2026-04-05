import { getDb } from './databaseSetupService.js';
import {
  listMesocycles,
  getMesocycle,
  createMesocycle,
  updateMesocycle,
  deleteMesocycle
} from './data-services/mesocyclesService.js';
import {
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram
} from './data-services/programsService.js';
import { requireField, requireExists, isDuplicateError } from './validation.js';

function success(data, message) {
  return { success: true, data, ...(message ? { message } : {}) };
}

function error(message, code) {
  return { success: false, error: message, ...(code ? { code } : {}) };
}

function requireDb() {
  const db = getDb();
  if (!db) throw { message: 'Database not initialised.', code: 'DB_NOT_READY' };
  return db;
}

// ---------------------------------------------------------------------------
// Mesocycles — mirrors /mesocycles and /mesocycles/{mesocycleId} from spec
// ---------------------------------------------------------------------------
export const mesocyclesApi = {

  /** GET /mesocycles */
  list: () => {
    try {
      return success(listMesocycles(requireDb()));
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** GET /mesocycles/{mesocycleId} */
  get: (id) => {
    try {
      const db = requireDb();
      const row = getMesocycle(db, id);
      requireExists(row, 'Mesocycle', id);
      return success(row);
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** POST /mesocycles */
  create: (input) => {
    try {
      const db = requireDb();
      const { program_id, program_name, start_date, microcycle_length } = input ?? {};
      requireField(program_id, 'program_id');
      requireExists(getProgram(db, program_id), 'Program', program_id);
      requireField(program_name, 'program_name');
      requireField(start_date, 'start_date');
      requireField(microcycle_length, 'microcycle_length');
      return success(createMesocycle(db, input), 'Mesocycle created.');
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** PUT /mesocycles/{mesocycleId} */
  update: (id, input) => {
    try {
      const db = requireDb();
      requireExists(getMesocycle(db, id), 'Mesocycle', id);
      const { program_id, program_name, start_date, microcycle_length } = input ?? {};
      requireField(program_id, 'program_id');
      requireExists(getProgram(db, program_id), 'Program', program_id);
      requireField(program_name, 'program_name');
      requireField(start_date, 'start_date');
      requireField(microcycle_length, 'microcycle_length');
      return success(updateMesocycle(db, id, input), 'Mesocycle updated.');
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** DELETE /mesocycles/{mesocycleId} */
  delete: (id) => {
    try {
      const db = requireDb();
      requireExists(getMesocycle(db, id), 'Mesocycle', id);
      deleteMesocycle(db, id);
      return success(null, 'Mesocycle deleted.');
    } catch (e) {
      return error(e.message, e.code);
    }
  }

};

// ---------------------------------------------------------------------------
// Programs — mirrors /programs and /programs/{programId} from spec
// ---------------------------------------------------------------------------
export const programsApi = {

  /** GET /programs */
  list: () => {
    try {
      return success(listPrograms(requireDb()));
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** GET /programs/{programId} */
  get: (id) => {
    try {
      const db = requireDb();
      const row = getProgram(db, id);
      requireExists(row, 'Program', id);
      return success(row);
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** POST /programs */
  create: (input) => {
    try {
      const db = requireDb();
      const { name } = input ?? {};
      requireField(name, 'name');
      return success(createProgram(db, input), 'Program created.');
    } catch (e) {
      if (isDuplicateError(e)) return error('A program with that name already exists.', 'DUPLICATE_NAME');
      return error(e.message, e.code);
    }
  },

  /** PUT /programs/{programId} */
  update: (id, input) => {
    try {
      const db = requireDb();
      requireExists(getProgram(db, id), 'Program', id);
      const { name } = input ?? {};
      requireField(name, 'name');
      return success(updateProgram(db, id, input), 'Program updated.');
    } catch (e) {
      if (isDuplicateError(e)) return error('A program with that name already exists.', 'DUPLICATE_NAME');
      return error(e.message, e.code);
    }
  },

  /** DELETE /programs/{programId} */
  delete: (id) => {
    try {
      const db = requireDb();
      requireExists(getProgram(db, id), 'Program', id);
      deleteProgram(db, id);
      return success(null, 'Program deleted.');
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** GET /programs/{programId}/mesocycles */
  listMesocycles: (programId) => {
    try {
      const db = requireDb();
      requireExists(getProgram(db, programId), 'Program', programId);
      return success(listMesocycles(db, programId));
    } catch (e) {
      return error(e.message, e.code);
    }
  }

};
