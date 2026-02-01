/**
 * Validation Utilities
 * 
 * Input validation helpers for API layer.
 * Throws errors that are caught by API error handlers.
 */

/**
 * Validate required string field
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of field for error message
 * @throws {Error} If value is empty or invalid
 */
export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validate positive number (must be > 0)
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of field for error message
 * @throws {Error} If value is not positive
 */
export function validatePositiveNumber(value, fieldName) {
  if (value !== null && value !== undefined && value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
}

/**
 * Validate non-negative number (must be >= 0)
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of field for error message
 * @throws {Error} If value is negative
 */
export function validateNonNegativeNumber(value, fieldName) {
  if (value !== null && value !== undefined && value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
}
