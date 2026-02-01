/**
 * Workout Groups API
 * 
 * Manages workout group (category) operations.
 * Examples: Push, Pull, Legs, Arms, etc.
 */

import {
  getAllWorkoutGroups,
  getWorkoutGroupById,
  createWorkoutGroup,
  updateWorkoutGroup,
  deleteWorkoutGroup
} from '../db/dataService.js';

import { successResponse, errorResponse } from './utils/response.js';
import { handleApiCall } from './utils/errorHandler.js';
import { validateRequired } from './utils/validation.js';

export const workoutGroupsApi = {
  /**
   * Get all workout groups
   */
  getAll: async () => {
    return handleApiCall(
      () => getAllWorkoutGroups(),
      'Failed to fetch workout groups'
    );
  },

  /**
   * Get a single workout group by ID
   */
  getById: async (id) => {
    return handleApiCall(
      () => {
        const group = getWorkoutGroupById(id);
        if (!group) {
          throw new Error('Workout group not found');
        }
        return group;
      },
      'Failed to fetch workout group'
    );
  },

  /**
   * Create a new workout group
   */
  create: async (data) => {
    try {
      validateRequired(data.name, 'Workout group name');
      
      // Check for duplicate name
      const existingGroups = getAllWorkoutGroups();
      if (existingGroups.some(g => g.name.toLowerCase() === data.name.trim().toLowerCase())) {
        return errorResponse('A workout group with this name already exists', 'VALIDATION_ERROR');
      }
      
      const id = await createWorkoutGroup(data.name.trim(), data.notes || '', data.id || null);
      return successResponse({ id }, 'Workout group created successfully');
    } catch (error) {
      console.error('Failed to create workout group', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Update an existing workout group
   */
  update: async (id, data) => {
    try {
      validateRequired(data.name, 'Workout group name');
      
      // Check for duplicate name (excluding current group)
      const existingGroups = getAllWorkoutGroups();
      if (existingGroups.some(g => g.id !== id && g.name.toLowerCase() === data.name.trim().toLowerCase())) {
        return errorResponse('A workout group with this name already exists', 'VALIDATION_ERROR');
      }
      
      await updateWorkoutGroup(id, data.name.trim(), data.notes || '');
      return successResponse({ id }, 'Workout group updated successfully');
    } catch (error) {
      console.error('Failed to update workout group', error);
      return errorResponse(error);
    }
  },

  /**
   * Delete a workout group
   */
  delete: async (id) => {
    return handleApiCall(
      async () => {
        await deleteWorkoutGroup(id);
        return { id };
      },
      'Failed to delete workout group'
    );
  }
};
