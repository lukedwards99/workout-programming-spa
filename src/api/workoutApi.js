/**
 * Workout API Layer
 * 
 * This layer provides a consistent interface between React components and the data service.
 * All methods return standardized response objects: { success, data/error, message }
 * 
 * Design principles:
 * - All methods are async
 * - Comprehensive error handling
 * - Input validation
 * - Standardized response format
 * - Future-proof for backend migration
 * 
 * New simplified schema:
 * - workout_sets replaces day_exercises + sets
 * - Every exercise must have at least one set
 */

import {
  // Days
  getAllDays,
  getDayById,
  getDaysCount,
  addDay,
  insertDayAfter,
  removeLastDay,
  deleteDay,
  
  // Workout Groups
  getAllWorkoutGroups,
  getWorkoutGroupById,
  createWorkoutGroup,
  updateWorkoutGroup,
  deleteWorkoutGroup,
  
  // Exercises
  getAllExercises,
  getExerciseById,
  getExercisesByWorkoutGroup,
  getExercisesByWorkoutGroups,
  createExercise,
  updateExercise,
  deleteExercise,
  
  // Day Workout Groups
  getDayWorkoutGroups,
  setDayWorkoutGroups,
  
  // Workout Sets (replaces day_exercises + sets)
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
  getSetCount,
  
  // Data Management
  clearWorkoutData,
  clearAllData,
  seedSampleData,
  
  // Program Generation
  generateWorkoutProgram
} from '../db/dataService.js';

// ===== UTILITIES =====

/**
 * Create a success response
 */
function successResponse(data, message = null) {
  const response = { success: true, data };
  if (message) response.message = message;
  return response;
}

/**
 * Create an error response
 */
function errorResponse(error, code = 'UNKNOWN_ERROR') {
  return {
    success: false,
    error: typeof error === 'string' ? error : error.message || 'An error occurred',
    code
  };
}

/**
 * Wrap an API call with error handling
 */
async function handleApiCall(apiFunction, errorMessage = 'Operation failed') {
  try {
    const result = await apiFunction();
    return successResponse(result);
  } catch (error) {
    console.error(errorMessage, error);
    return errorResponse(`${errorMessage}: ${error.message}`);
  }
}

/**
 * Validate required string field
 */
function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validate positive number
 */
function validatePositiveNumber(value, fieldName) {
  if (value !== null && value !== undefined && value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
}

/**
 * Validate non-negative number
 */
function validateNonNegativeNumber(value, fieldName) {
  if (value !== null && value !== undefined && value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
}

// ===== WORKOUT GROUPS API =====

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

// ===== EXERCISES API =====

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

// ===== DAYS API =====

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
  add: async (dayName, id = null) => {
    try {
      validateRequired(dayName, 'Day name');
      
      // Check for duplicate name
      const existingDays = getAllDays();
      if (existingDays.some(d => d.day_name.toLowerCase() === dayName.trim().toLowerCase())) {
        throw new Error('A day with this name already exists');
      }
      
      const newId = await addDay(dayName.trim(), id);
      return successResponse({ id: newId }, 'Day added successfully');
    } catch (error) {
      console.error('Failed to add day', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Insert a new day after a specific day
   */
  insertAfter: async (dayName, afterDayId) => {
    try {
      validateRequired(dayName, 'Day name');
      validateRequired(afterDayId, 'Day ID');
      
      // Check for duplicate name
      const existingDays = getAllDays();
      if (existingDays.some(d => d.day_name.toLowerCase() === dayName.trim().toLowerCase())) {
        return errorResponse('A day with this name already exists', 'VALIDATION_ERROR');
      }
      
      const id = await insertDayAfter(dayName.trim(), afterDayId);
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
  }
};

// ===== DAY WORKOUT GROUPS API =====

export const dayWorkoutGroupsApi = {
  /**
   * Get workout groups for a specific day
   */
  getByDay: async (dayId) => {
    return handleApiCall(
      () => getDayWorkoutGroups(dayId),
      'Failed to fetch workout groups for day'
    );
  },

  /**
   * Set workout groups for a day (replaces all existing)
   */
  setForDay: async (dayId, workoutGroupIds) => {
    return handleApiCall(
      async () => {
        await setDayWorkoutGroups(dayId, workoutGroupIds);
        return { dayId, workoutGroupIds };
      },
      'Failed to update workout groups for day'
    );
  }
};

// ===== WORKOUT SETS API (replaces dayExercises + sets) =====

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

// ===== DATA MANAGEMENT API =====

export const dataApi = {
  /**
   * Clear all workout data (sets and day associations)
   * Preserves workout groups and exercises
   */
  clearWorkoutData: async () => {
    return handleApiCall(
      async () => {
        await clearWorkoutData();
        return null;
      },
      'Failed to clear workout data'
    );
  },

  /**
   * Clear all data (complete database reset)
   * Clears workout groups, exercises, days, and all associations
   */
  clearAllData: async () => {
    return handleApiCall(
      async () => {
        await clearAllData();
        return null;
      },
      'Failed to clear all data'
    );
  },

  /**
   * Seed sample workout data
   * Adds sample workout groups, exercises, and 7 days
   */
  seedSampleData: async () => {
    return handleApiCall(
      async () => {
        await seedSampleData();
        return null;
      },
      'Failed to seed sample data'
    );
  }
};

// ===== PROGRAM GENERATION API =====

export const programApi = {
  /**
   * Generate workout program automatically
   * Currently a stub for future implementation
   */
  generate: async (options = {}) => {
    try {
      const result = generateWorkoutProgram(options);
      if (result.success) {
        return successResponse(null, result.message);
      } else {
        return errorResponse(result.message, 'NOT_IMPLEMENTED');
      }
    } catch (error) {
      console.error('Failed to generate program', error);
      return errorResponse(error);
    }
  }
};

// ===== DEFAULT EXPORT =====

export default {
  workoutGroups: workoutGroupsApi,
  exercises: exercisesApi,
  days: daysApi,
  dayWorkoutGroups: dayWorkoutGroupsApi,
  workoutSets: workoutSetsApi,
  data: dataApi,
  program: programApi
};
