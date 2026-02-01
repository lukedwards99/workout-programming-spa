/**
 * Exercises API
 * 
 * Manages exercise operations.
 * Exercises belong to workout groups.
 */

import {
  getAllExercises,
  getExerciseById,
  getExercisesByWorkoutGroup,
  getExercisesByWorkoutGroups,
  createExercise,
  updateExercise,
  deleteExercise,
  getWorkoutGroupById
} from '../db/dataService.js';

import { successResponse, errorResponse } from './utils/response.js';
import { handleApiCall } from './utils/errorHandler.js';
import { validateRequired } from './utils/validation.js';

export const exercisesApi = {
  /**
   * Get all exercises
   */
  getAll: async () => {
    return handleApiCall(
      () => getAllExercises(),
      'Failed to fetch exercises'
    );
  },

  /**
   * Get a single exercise by ID
   */
  getById: async (id) => {
    return handleApiCall(
      () => {
        const exercise = getExerciseById(id);
        if (!exercise) {
          throw new Error('Exercise not found');
        }
        return exercise;
      },
      'Failed to fetch exercise'
    );
  },

  /**
   * Get exercises by workout group ID
   */
  getByWorkoutGroup: async (workoutGroupId) => {
    return handleApiCall(
      () => getExercisesByWorkoutGroup(workoutGroupId),
      'Failed to fetch exercises for workout group'
    );
  },

  /**
   * Get exercises by multiple workout group IDs
   */
  getByWorkoutGroups: async (workoutGroupIds) => {
    return handleApiCall(
      () => {
        if (!workoutGroupIds || workoutGroupIds.length === 0) {
          return [];
        }
        return getExercisesByWorkoutGroups(workoutGroupIds);
      },
      'Failed to fetch exercises for workout groups'
    );
  },

  /**
   * Create a new exercise
   */
  create: async (data) => {
    try {
      validateRequired(data.name, 'Exercise name');
      validateRequired(data.workoutGroupId, 'Workout group');
      
      // Verify workout group exists
      const group = getWorkoutGroupById(data.workoutGroupId);
      if (!group) {
        return errorResponse('Workout group not found', 'VALIDATION_ERROR');
      }
      
      const id = await createExercise(
        data.workoutGroupId,
        data.name.trim(),
        data.notes || ''
      );
      return successResponse({ id }, 'Exercise created successfully');
    } catch (error) {
      console.error('Failed to create exercise', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Update an existing exercise
   */
  update: async (id, data) => {
    try {
      validateRequired(data.name, 'Exercise name');
      validateRequired(data.workoutGroupId, 'Workout group');
      
      // Verify workout group exists
      const group = getWorkoutGroupById(data.workoutGroupId);
      if (!group) {
        return errorResponse('Workout group not found', 'VALIDATION_ERROR');
      }
      
      await updateExercise(
        id,
        data.workoutGroupId,
        data.name.trim(),
        data.notes || ''
      );
      return successResponse({ id }, 'Exercise updated successfully');
    } catch (error) {
      console.error('Failed to update exercise', error);
      return errorResponse(error);
    }
  },

  /**
   * Delete an exercise
   */
  delete: async (id) => {
    return handleApiCall(
      async () => {
        await deleteExercise(id);
        return { id };
      },
      'Failed to delete exercise'
    );
  }
};
