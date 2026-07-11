import { queryValue } from '../db/databaseService';

export const summaryApi = {
  getStats() {
    const exGroupCount = queryValue('SELECT COUNT(*) FROM exercise_groups') || 0;
    const exCount = queryValue('SELECT COUNT(*) FROM exercises') || 0;
    const mesoCount = queryValue('SELECT COUNT(*) FROM mesocycles') || 0;
    const woCount = queryValue('SELECT COUNT(*) FROM workouts') || 0;
    const setCount = queryValue('SELECT COUNT(*) FROM workout_sets') || 0;

    return {
      mesocycles: mesoCount,
      workouts: woCount,
      exerciseGroups: exGroupCount,
      exercises: exCount,
      sets: setCount,
    };
  },
};
