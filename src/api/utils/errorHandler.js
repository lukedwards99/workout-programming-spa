/**
 * Error Handler Utilities
 * 
 * Wraps API calls with standardized error handling.
 */

import { successResponse, errorResponse } from './response.js';

/**
 * Wrap an API call with error handling
 * @param {Function} apiFunction - The async function to execute
 * @param {string} errorMessage - Error message prefix
 * @returns {Promise<Object>} Standardized response object
 */
export async function handleApiCall(apiFunction, errorMessage = 'Operation failed') {
  try {
    const result = await apiFunction();
    return successResponse(result);
  } catch (error) {
    console.error(errorMessage, error);
    return errorResponse(`${errorMessage}: ${error.message}`);
  }
}
