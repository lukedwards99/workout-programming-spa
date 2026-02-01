/**
 * Days API
 * 
 * Manages workout day operations.
 * Days define the sequence of workouts in a program.
 */

import {
  getAllDays,
  getDayById,
  getDaysCount,
  addDay,
  insertDayAfter,
  removeLastDay,
  deleteDay,
  updateDayNotes,
  updateDayName,
  duplicateDay
} from '../db/dataService.js';

import { successResponse, errorResponse } from './utils/response.js';
import { handleApiCall } from './utils/errorHandler.js';
import { validateRequired } from './utils/validation.js';

export const daysApi = {
  /**
   * Get all days
   */
  getAll: async () => {
    return handleApiCall(
      () => getAllDays(),
      'Failed to fetch days'
    );
  },

  /**
   * Get a single day by ID
   */
  getById: async (id) => {
    return handleApiCall(
      () => {
        const day = getDayById(id);
        if (!day) {
          throw new Error('Day not found');
        }
        return day;
      },
      'Failed to fetch day'
    );
  },

  /**
   * Get count of days
   */
  getCount: async () => {
    return handleApiCall(
      () => ({ count: getDaysCount() }),
      'Failed to get day count'
    );
  },

  /**
   * Add a new day
   */
  add: async (dayName, id = null, notes = '') => {
    try {
      validateRequired(dayName, 'Day name');
      
      // Check for duplicate name
      const existingDays = getAllDays();
      if (existingDays.some(d => d.day_name.toLowerCase() === dayName.trim().toLowerCase())) {
        throw new Error('A day with this name already exists');
      }
      
      const newId = await addDay(dayName.trim(), id, notes);
      return successResponse({ id: newId }, 'Day added successfully');
    } catch (error) {
      console.error('Failed to add day', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Insert a new day after a specific day
   */
  insertAfter: async (dayName, afterDayId, notes = '') => {
    try {
      validateRequired(dayName, 'Day name');
      validateRequired(afterDayId, 'Day ID');
      
      // Check for duplicate name
      const existingDays = getAllDays();
      if (existingDays.some(d => d.day_name.toLowerCase() === dayName.trim().toLowerCase())) {
        return errorResponse('A day with this name already exists', 'VALIDATION_ERROR');
      }
      
      const id = await insertDayAfter(dayName.trim(), afterDayId, notes);
      return successResponse({ id }, 'Day added successfully');
    } catch (error) {
      console.error('Failed to insert day', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Remove the last day
   */
  removeLast: async () => {
    try {
      const count = getDaysCount();
      if (count === 0) {
        return errorResponse('No days to remove', 'VALIDATION_ERROR');
      }
      
      await removeLastDay();
      return successResponse(null, 'Day removed successfully');
    } catch (error) {
      console.error('Failed to remove day', error);
      return errorResponse(error);
    }
  },

  /**
   * Delete a specific day
   */
  delete: async (dayId) => {
    try {
      validateRequired(dayId, 'Day ID');
      
      await deleteDay(dayId);
      return successResponse(null, 'Day deleted successfully');
    } catch (error) {
      console.error('Failed to delete day', error);
      return errorResponse(error);
    }
  },

  /**
   * Update notes for a specific day
   */
  updateNotes: async (dayId, notes) => {
    try {
      validateRequired(dayId, 'Day ID');
      
      await updateDayNotes(dayId, notes || '');
      return successResponse({ dayId }, 'Day notes updated successfully');
    } catch (error) {
      console.error('Failed to update day notes', error);
      return errorResponse(error);
    }
  },

  /**
   * Rename a day
   */
  rename: async (dayId, newName) => {
    try {
      validateRequired(dayId, 'Day ID');
      validateRequired(newName, 'Day name');
      
      // Check for duplicate name (excluding current day)
      const existingDays = getAllDays();
      if (existingDays.some(d => d.id !== dayId && d.day_name.toLowerCase() === newName.trim().toLowerCase())) {
        return errorResponse('A day with this name already exists', 'VALIDATION_ERROR');
      }
      
      await updateDayName(dayId, newName.trim());
      return successResponse({ dayId }, 'Day renamed successfully');
    } catch (error) {
      console.error('Failed to rename day', error);
      return errorResponse(error);
    }
  },

  /**
   * Duplicate a day (including workout groups and sets)
   * Appends the new day at the end of the sequence
   */
  duplicate: async (dayId) => {
    try {
      validateRequired(dayId, 'Day ID');
      
      const newDayId = await duplicateDay(dayId);
      return successResponse({ id: newDayId }, 'Day duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate day', error);
      return errorResponse(error);
    }
  }
};
