import { queryValue } from '../db/databaseService';

export const summaryApi = {
  getStats() {
    return {
      programs: queryValue('SELECT COUNT(*) FROM programs') || 0,
      mesocycles: queryValue('SELECT COUNT(*) FROM mesocycles') || 0,
      workouts: queryValue('SELECT COUNT(*) FROM workouts') || 0,
      exerciseGroups: queryValue('SELECT COUNT(*) FROM exercise_groups') || 0,
      exercises: queryValue('SELECT COUNT(*) FROM exercises') || 0,
      sets: queryValue('SELECT COUNT(*) FROM workout_sets') || 0,
    };
  },
};
