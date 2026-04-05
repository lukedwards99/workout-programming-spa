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
      const row = getMesocycle(requireDb(), id);
      if (!row) return error(`Mesocycle ${id} not found.`, 'NOT_FOUND');
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
      if (!program_id) return error('program_id is required.', 'VALIDATION_ERROR');
      if (!getProgram(db, program_id)) return error(`Program ${program_id} not found.`, 'NOT_FOUND');
      if (!program_name) return error('program_name is required.', 'VALIDATION_ERROR');
      if (!start_date) return error('start_date is required.', 'VALIDATION_ERROR');
      if (!microcycle_length) return error('microcycle_length is required.', 'VALIDATION_ERROR');
      return success(createMesocycle(db, input), 'Mesocycle created.');
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** PUT /mesocycles/{mesocycleId} */
  update: (id, input) => {
    try {
      const db = requireDb();
      if (!getMesocycle(db, id)) return error(`Mesocycle ${id} not found.`, 'NOT_FOUND');
      const { program_id, program_name, start_date, microcycle_length } = input ?? {};
      if (!program_id) return error('program_id is required.', 'VALIDATION_ERROR');
      if (!getProgram(db, program_id)) return error(`Program ${program_id} not found.`, 'NOT_FOUND');
      if (!program_name) return error('program_name is required.', 'VALIDATION_ERROR');
      if (!start_date) return error('start_date is required.', 'VALIDATION_ERROR');
      if (!microcycle_length) return error('microcycle_length is required.', 'VALIDATION_ERROR');
      return success(updateMesocycle(db, id, input), 'Mesocycle updated.');
    } catch (e) {
      return error(e.message, e.code);
    }
  },

  /** DELETE /mesocycles/{mesocycleId} */
  delete: (id) => {
    try {
      const db = requireDb();
      if (!getMesocycle(db, id)) return error(`Mesocycle ${id} not found.`, 'NOT_FOUND');
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
      const row = getProgram(requireDb(), id);
      if (!row) return error(`Program ${id} not found.`, 'NOT_FOUND');
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
      if (!name) return error('name is required.', 'VALIDATION_ERROR');
      return success(createProgram(db, input), 'Program created.');
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return error('A program with that name already exists.', 'DUPLICATE_NAME');
      return error(e.message, e.code);
    }
  },

  /** PUT /programs/{programId} */
  update: (id, input) => {
    try {
      const db = requireDb();
      if (!getProgram(db, id)) return error(`Program ${id} not found.`, 'NOT_FOUND');
      const { name } = input ?? {};
      if (!name) return error('name is required.', 'VALIDATION_ERROR');
      return success(updateProgram(db, id, input), 'Program updated.');
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return error('A program with that name already exists.', 'DUPLICATE_NAME');
      return error(e.message, e.code);
    }
  },

  /** DELETE /programs/{programId} */
  delete: (id) => {
    try {
      const db = requireDb();
      if (!getProgram(db, id)) return error(`Program ${id} not found.`, 'NOT_FOUND');
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
      if (!getProgram(db, programId)) return error(`Program ${programId} not found.`, 'NOT_FOUND');
      return success(listMesocycles(db, programId));
    } catch (e) {
      return error(e.message, e.code);
    }
  }

};
