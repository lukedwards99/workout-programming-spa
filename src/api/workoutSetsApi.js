/**
 * Workout Sets API
 * 
 * Manages workout set operations.
 * Replaces the old day_exercises + sets tables with a unified approach.
 * Each set belongs to a day and exercise.
 */

import {
  getAllWorkoutSets,
  getWorkoutSetsByDay,
  getWorkoutSetsByDayAndExercise,
  getWorkoutSetById,
  getExercisesByDay,
  getWorkoutSetsByDayGrouped,
  createWorkoutSet,
  updateWorkoutSet,
  deleteWorkoutSet,
  deleteWorkoutSetsByDayAndExercise,
  deleteWorkoutSetsByDay,
  getSetCount
} from '../db/dataService.js';

import { successResponse, errorResponse } from './utils/response.js';
import { handleApiCall } from './utils/errorHandler.js';
import { validateRequired, validatePositiveNumber, validateNonNegativeNumber } from './utils/validation.js';

export const workoutSetsApi = {
  /**
   * Get all workout sets
   */
  getAll: async () => {
    return handleApiCall(
      () => getAllWorkoutSets(),
      'Failed to fetch workout sets'
    );
  },

  /**
   * Get all sets for a specific day
   */
  getByDay: async (dayId) => {
    return handleApiCall(
      () => getWorkoutSetsByDay(dayId),
      'Failed to fetch sets for day'
    );
  },

  /**
   * Get sets for a day grouped by exercise
   * Returns array of { exercise_id, exercise_name, exercise_order, sets: [...] }
   */
  getByDayGrouped: async (dayId) => {
    return handleApiCall(
      () => getWorkoutSetsByDayGrouped(dayId),
      'Failed to fetch grouped sets for day'
    );
  },

  /**
   * Get all sets for a specific exercise on a day
   */
  getByDayAndExercise: async (dayId, exerciseId) => {
    return handleApiCall(
      () => getWorkoutSetsByDayAndExercise(dayId, exerciseId),
      'Failed to fetch sets for exercise on day'
    );
  },

  /**
   * Get a single workout set by ID
   */
  getById: async (id) => {
    return handleApiCall(
      () => {
        const set = getWorkoutSetById(id);
        if (!set) {
          throw new Error('Workout set not found');
        }
        return set;
      },
      'Failed to fetch workout set'
    );
  },

  /**
   * Get distinct exercises used on a day
   */
  getExercisesByDay: async (dayId) => {
    return handleApiCall(
      () => getExercisesByDay(dayId),
      'Failed to fetch exercises for day'
    );
  },

  /**
   * Create a new workout set
   * Note: exerciseOrder and setOrder are auto-calculated if not provided
   */
  create: async (data) => {
    try {
      validateRequired(data.dayId, 'Day');
      validateRequired(data.exerciseId, 'Exercise');
      
      // Validate numeric fields if provided
      if (data.reps !== null && data.reps !== undefined) {
        validatePositiveNumber(data.reps, 'Reps');
      }
      if (data.weight !== null && data.weight !== undefined) {
        validateNonNegativeNumber(data.weight, 'Weight');
      }
      if (data.rir !== null && data.rir !== undefined) {
        validateNonNegativeNumber(data.rir, 'RIR');
      }
      
      const id = await createWorkoutSet(
        data.dayId,
        data.exerciseId,
        data.exerciseOrder || null,
        data.setOrder || null,
        data.reps || null,
        data.weight || null,
        data.rir || null,
        data.notes || '',
        data.id || null
      );
      
      return successResponse({ id }, 'Workout set created successfully');
    } catch (error) {
      console.error('Failed to create workout set', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Update an existing workout set
   */
  update: async (id, data) => {
    try {
      // Get current set to fill in missing values
      const currentSet = getWorkoutSetById(id);
      if (!currentSet) {
        return errorResponse('Workout set not found', 'NOT_FOUND');
      }
      
      // Validate numeric fields if provided
      if (data.reps !== null && data.reps !== undefined) {
        validatePositiveNumber(data.reps, 'Reps');
      }
      if (data.weight !== null && data.weight !== undefined) {
        validateNonNegativeNumber(data.weight, 'Weight');
      }
      if (data.rir !== null && data.rir !== undefined) {
        validateNonNegativeNumber(data.rir, 'RIR');
      }
      
      // Use current values if not provided
      const exerciseOrder = data.exerciseOrder !== undefined ? data.exerciseOrder : currentSet.exercise_order;
      const setOrder = data.setOrder !== undefined ? data.setOrder : currentSet.set_order;
      const reps = data.reps !== undefined ? data.reps : currentSet.reps;
      const weight = data.weight !== undefined ? data.weight : currentSet.weight;
      const rir = data.rir !== undefined ? data.rir : currentSet.rir;
      const notes = data.notes !== undefined ? data.notes : currentSet.notes;
      
      await updateWorkoutSet(
        id,
        exerciseOrder,
        setOrder,
        reps,
        weight,
        rir,
        notes || ''
      );
      
      return successResponse({ id }, 'Workout set updated successfully');
    } catch (error) {
      console.error('Failed to update workout set', error);
      return errorResponse(error);
    }
  },

  /**
   * Delete a workout set
   */
  delete: async (id) => {
    return handleApiCall(
      async () => {
        await deleteWorkoutSet(id);
        return { id };
      },
      'Failed to delete workout set'
    );
  },

  /**
   * Delete all sets for an exercise on a day
   * Used when removing an exercise from a day
   */
  deleteByDayAndExercise: async (dayId, exerciseId) => {
    return handleApiCall(
      async () => {
        await deleteWorkoutSetsByDayAndExercise(dayId, exerciseId);
        return { dayId, exerciseId };
      },
      'Failed to delete exercise from day'
    );
  },

  /**
   * Delete all sets for a day
   */
  deleteByDay: async (dayId) => {
    return handleApiCall(
      async () => {
        await deleteWorkoutSetsByDay(dayId);
        return { dayId };
      },
      'Failed to delete all sets for day'
    );
  },

  /**
   * Get count of sets for a day/exercise combination
   */
  getSetCount: async (dayId, exerciseId) => {
    return handleApiCall(
      () => ({ count: getSetCount(dayId, exerciseId) }),
      'Failed to get set count'
    );
  }
};
