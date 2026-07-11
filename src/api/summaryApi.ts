import type { ProgramSummaryStats } from '../types/domain';
import { queryValue } from '../db/databaseService';

export const summaryApi = {
  getStats(): ProgramSummaryStats {
    const exGroupCount = (queryValue('SELECT COUNT(*) FROM exercise_groups') as number) || 0;
    const exCount = (queryValue('SELECT COUNT(*) FROM exercises') as number) || 0;
    const mesoCount = (queryValue('SELECT COUNT(*) FROM mesocycles') as number) || 0;
    const woCount = (queryValue('SELECT COUNT(*) FROM workouts') as number) || 0;
    const setCount = (queryValue('SELECT COUNT(*) FROM workout_sets') as number) || 0;

    return {
      mesocycles: mesoCount,
      workouts: woCount,
      exerciseGroups: exGroupCount,
      exercises: exCount,
      sets: setCount,
    };
  },
};
