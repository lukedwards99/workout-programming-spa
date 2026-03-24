import { getDb } from './databaseSetupService.js';
import {
  listMesocycles,
  getMesocycle,
  createMesocycle,
  updateMesocycle,
  deleteMesocycle
} from './data-services/mesocyclesService.js';

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
      const { program_name, start_date, microcycle_length } = input ?? {};
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
      const { program_name, start_date, microcycle_length } = input ?? {};
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
