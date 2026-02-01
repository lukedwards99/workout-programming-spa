/**
 * Response Utilities
 * 
 * Standardized response format helpers for API layer.
 * All API methods return objects with { success, data/error, message }
 */

/**
 * Create a success response
 * @param {*} data - The data to return
 * @param {string|null} message - Optional success message
 * @returns {Object} Success response object
 */
export function successResponse(data, message = null) {
  const response = { success: true, data };
  if (message) response.message = message;
  return response;
}

/**
 * Create an error response
 * @param {Error|string} error - Error object or message
 * @param {string} code - Error code for programmatic handling
 * @returns {Object} Error response object
 */
export function errorResponse(error, code = 'UNKNOWN_ERROR') {
  return {
    success: false,
    error: typeof error === 'string' ? error : error.message || 'An error occurred',
    code
  };
}
