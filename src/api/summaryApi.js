import { queryValue } from '../db/databaseService';

export const summaryApi = {
  getStats(programId) {
    let exGroupCount, exCount;
    if (programId) {
      exGroupCount = queryValue('SELECT COUNT(*) FROM exercise_groups WHERE program_id = ?', [programId]) || 0;
      exCount = queryValue(
        'SELECT COUNT(*) FROM exercises e JOIN exercise_groups eg ON e.exercise_group_id = eg.id WHERE eg.program_id = ?',
        [programId]
      ) || 0;
    } else {
      exGroupCount = queryValue('SELECT COUNT(*) FROM exercise_groups') || 0;
      exCount = queryValue('SELECT COUNT(*) FROM exercises') || 0;
    }

    return {
      programs: queryValue('SELECT COUNT(*) FROM programs') || 0,
      mesocycles: queryValue('SELECT COUNT(*) FROM mesocycles') || 0,
      workouts: queryValue('SELECT COUNT(*) FROM workouts') || 0,
      exerciseGroups: exGroupCount,
      exercises: exCount,
      sets: queryValue('SELECT COUNT(*) FROM workout_sets') || 0,
    };
  },
};
