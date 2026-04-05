/**
 * Throws a structured VALIDATION_ERROR if value is falsy.
 * @param {*} value
 * @param {string} fieldName - Human-readable field label used in the error message.
 */
export function requireField(value, fieldName) {
  if (!value) throw { message: `${fieldName} is required.`, code: 'VALIDATION_ERROR' };
}

/**
 * Throws a structured NOT_FOUND error if row is null/undefined.
 * @param {object|null} row - The result of a DB lookup (null if not found).
 * @param {string} entityName - Human-readable entity label (e.g. 'Program').
 * @param {number|string} id - The ID that was looked up.
 */
export function requireExists(row, entityName, id) {
  if (!row) throw { message: `${entityName} ${id} not found.`, code: 'NOT_FOUND' };
}

/**
 * Returns true when a SQLite UNIQUE constraint violation caused the error.
 * @param {Error|{message: string}} e
 * @returns {boolean}
 */
export function isDuplicateError(e) {
  return !!e.message?.includes('UNIQUE');
}
