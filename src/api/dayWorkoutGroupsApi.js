/**
 * Day Workout Groups API
 * 
 * Manages which workout groups are active on each day.
 * Used for filtering exercises by selected workout groups.
 */

import {
  getDayWorkoutGroups,
  setDayWorkoutGroups
} from '../db/dataService.js';

import { handleApiCall } from './utils/errorHandler.js';

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
