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
 */

import {
  // Days
  getAllDays,
  getDayById,
  getDaysCount,
  addDay,
  removeLastDay,
  
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
  
  // Sets
  getAllSets,
  getSetsByDay,
  getSetById,
  createSet,
  updateSet,
  deleteSet,
  
  // CSV Export/Import
  exportToCSV,
  downloadCSV,
  importFromCSV,
  exportSetupDataToCSV,
  downloadSetupDataCSV,
  importSetupDataFromCSV,
  clearWorkoutData,
  clearAllData,
  
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
      
      const id = await createWorkoutGroup(data.name.trim(), data.notes || '');
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
  add: async (dayName) => {
    try {
      validateRequired(dayName, 'Day name');
      
      // Check for duplicate name
      const existingDays = getAllDays();
      if (existingDays.some(d => d.day_name.toLowerCase() === dayName.trim().toLowerCase())) {
        return errorResponse('A day with this name already exists', 'VALIDATION_ERROR');
      }
      
      const id = await addDay(dayName.trim());
      return successResponse({ id }, 'Day added successfully');
    } catch (error) {
      console.error('Failed to add day', error);
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

// ===== SETS API =====

export const setsApi = {
  /**
   * Get all sets
   */
  getAll: async () => {
    return handleApiCall(
      () => getAllSets(),
      'Failed to fetch sets'
    );
  },

  /**
   * Get all sets for a specific day
   */
  getByDay: async (dayId) => {
    return handleApiCall(
      () => getSetsByDay(dayId),
      'Failed to fetch sets for day'
    );
  },

  /**
   * Get sets for a day grouped by exercise
   * Returns an object where keys are exercise IDs and values contain exercise info and sets
   */
  getByDayGrouped: async (dayId) => {
    return handleApiCall(
      () => {
        const sets = getSetsByDay(dayId);
        
        // Group sets by exercise
        const groupedSets = {};
        sets.forEach(set => {
          const exerciseId = set.exercise_id;
          
          if (!groupedSets[exerciseId]) {
            groupedSets[exerciseId] = {
              exerciseId: set.exercise_id,
              exerciseName: set.exercise_name,
              workoutGroupId: set.workout_group_id,
              workoutGroupName: set.workout_group_name,
              exerciseNotes: set.exercise_notes || '',
              sets: []
            };
          }
          
          groupedSets[exerciseId].sets.push({
            id: set.id,
            set_order: set.set_order,
            reps: set.reps,
            rir: set.rir,
            notes: set.notes || ''
          });
        });
        
        return groupedSets;
      },
      'Failed to fetch grouped sets for day'
    );
  },

  /**
   * Create a new set
   */
  create: async (data) => {
    try {
      validateRequired(data.dayId, 'Day');
      validateRequired(data.exerciseId, 'Exercise');
      
      if (data.reps !== null && data.reps !== undefined) {
        validatePositiveNumber(data.reps, 'Reps');
      }
      
      if (data.rir !== null && data.rir !== undefined) {
        validateNonNegativeNumber(data.rir, 'RIR');
      }
      
      // Verify day exists
      const day = getDayById(data.dayId);
      if (!day) {
        return errorResponse('Day not found', 'VALIDATION_ERROR');
      }
      
      // Verify exercise exists
      const exercise = getExerciseById(data.exerciseId);
      if (!exercise) {
        return errorResponse('Exercise not found', 'VALIDATION_ERROR');
      }
      
      const id = await createSet(
        data.dayId,
        data.exerciseId,
        data.reps,
        data.rir,
        data.notes || ''
      );
      return successResponse({ id }, 'Set added successfully');
    } catch (error) {
      console.error('Failed to create set', error);
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  },

  /**
   * Update an existing set
   */
  update: async (id, data) => {
    try {
      // Get current set data to preserve unchanged fields
      const currentSet = getSetById(id);
      if (!currentSet) {
        return errorResponse('Set not found', 'NOT_FOUND');
      }
      
      // Validate if provided
      if (data.reps !== null && data.reps !== undefined) {
        validatePositiveNumber(data.reps, 'Reps');
      }
      
      if (data.rir !== null && data.rir !== undefined) {
        validateNonNegativeNumber(data.rir, 'RIR');
      }
      
      // Use current values if not provided
      const setOrder = data.setOrder !== undefined ? data.setOrder : currentSet.set_order;
      const reps = data.reps !== undefined ? data.reps : currentSet.reps;
      const rir = data.rir !== undefined ? data.rir : currentSet.rir;
      const notes = data.notes !== undefined ? data.notes : currentSet.notes;
      
      await updateSet(id, setOrder, reps, rir, notes || '');
      return successResponse({ id }, 'Set updated successfully');
    } catch (error) {
      console.error('Failed to update set', error);
      return errorResponse(error);
    }
  },

  /**
   * Delete a set
   */
  delete: async (id) => {
    return handleApiCall(
      async () => {
        await deleteSet(id);
        return { id };
      },
      'Failed to delete set'
    );
  }
};

// ===== DATA MANAGEMENT API =====

export const dataApi = {
  /**
   * Export all workout data to CSV format
   * Returns the CSV string
   */
  export: async () => {
    return handleApiCall(
      () => {
        const csv = exportToCSV();
        return { csv };
      },
      'Failed to export data'
    );
  },

  /**
   * Download all workout data as CSV file
   * Triggers browser download
   */
  download: async () => {
    try {
      downloadCSV();
      const date = new Date().toISOString().split('T')[0];
      const filename = `workout-program-${date}.csv`;
      return successResponse({ filename }, 'CSV file downloaded successfully');
    } catch (error) {
      console.error('Failed to download CSV', error);
      return errorResponse(error, 'EXPORT_ERROR');
    }
  },

  /**
   * Import workout data from CSV string
   * Clears existing sets and rebuilds from CSV
   */
  import: async (csvString) => {
    try {
      validateRequired(csvString, 'CSV data');
      
      const result = await importFromCSV(csvString);
      return successResponse(
        { rowCount: result.rowCount },
        `Successfully imported ${result.rowCount} rows`
      );
    } catch (error) {
      console.error('Failed to import CSV', error);
      return errorResponse(error, 'IMPORT_ERROR');
    }
  },

  /**
   * Export setup data (workout groups & exercises) to CSV format
   * Returns the CSV string
   */
  exportSetup: async () => {
    return handleApiCall(
      () => {
        const csv = exportSetupDataToCSV();
        return { csv };
      },
      'Failed to export setup data'
    );
  },

  /**
   * Download setup data as CSV file
   * Triggers browser download
   */
  downloadSetup: async () => {
    try {
      downloadSetupDataCSV();
      const date = new Date().toISOString().split('T')[0];
      const filename = `workout-setup-${date}.csv`;
      return successResponse({ filename }, 'Setup CSV file downloaded successfully');
    } catch (error) {
      console.error('Failed to download setup CSV', error);
      return errorResponse(error, 'EXPORT_ERROR');
    }
  },

  /**
   * Import setup data from CSV string
   * Clears existing workout groups and exercises, then rebuilds
   */
  importSetup: async (csvString) => {
    try {
      validateRequired(csvString, 'CSV data');
      
      const result = await importSetupDataFromCSV(csvString);
      return successResponse(
        { rowCount: result.rowCount },
        `Successfully imported ${result.rowCount} setup items`
      );
    } catch (error) {
      console.error('Failed to import setup CSV', error);
      return errorResponse(error, 'IMPORT_ERROR');
    }
  },

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
   * Download both setup and program data files
   * Downloads two CSV files with matching timestamps
   */
  downloadAll: async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      
      // Download setup file
      downloadSetupDataCSV();
      
      // Small delay to prevent browser blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Download program file
      downloadCSV();
      
      return successResponse(
        { 
          setupFilename: `workout-setup-${date}.csv`,
          programFilename: `workout-program-${date}.csv`
        },
        'Both CSV files downloaded successfully'
      );
    } catch (error) {
      console.error('Failed to download files', error);
      return errorResponse(error, 'EXPORT_ERROR');
    }
  },

  /**
   * Import both setup and program data from CSV strings
   * Clears all existing data and rebuilds from both CSV files
   * Both files must be provided and are tightly coupled
   */
  importAll: async (setupCsv, programCsv) => {
    try {
      // Validate both files are provided
      validateRequired(setupCsv, 'Setup CSV data');
      validateRequired(programCsv, 'Program CSV data');
      
      // Clear all existing data
      await clearAllData();
      
      // Import setup data first (workout groups and exercises)
      const setupResult = await importSetupDataFromCSV(setupCsv);
      
      // Then import program data (days, sets, associations)
      const programResult = await importFromCSV(programCsv);
      
      return successResponse(
        { 
          setupRows: setupResult.rowCount,
          programRows: programResult.rowCount
        },
        `Successfully imported ${setupResult.rowCount} setup items and ${programResult.rowCount} program rows`
      );
    } catch (error) {
      console.error('Failed to import data', error);
      return errorResponse(error, 'IMPORT_ERROR');
    }
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
  sets: setsApi,
  data: dataApi,
  program: programApi
};
