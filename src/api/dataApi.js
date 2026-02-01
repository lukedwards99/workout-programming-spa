/**
 * Data Management API
 * 
 * Handles bulk data operations like clearing and seeding.
 */

import {
  clearWorkoutData,
  clearAllData,
  seedSampleData
} from '../db/dataService.js';

import { handleApiCall } from './utils/errorHandler.js';

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
