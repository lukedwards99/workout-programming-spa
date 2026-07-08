import { queryValue } from '../db/databaseService';

export const summaryApi = {
  getStats(programId) {
    let exGroupCount, exCount, mesoCount, woCount, setCount;
    if (programId) {
      exGroupCount = queryValue('SELECT COUNT(*) FROM exercise_groups WHERE program_id = ?', [programId]) || 0;
      exCount = queryValue(
        'SELECT COUNT(*) FROM exercises e JOIN exercise_groups eg ON e.exercise_group_id = eg.id WHERE eg.program_id = ?',
        [programId]
      ) || 0;
      mesoCount = queryValue('SELECT COUNT(*) FROM mesocycles WHERE program_id = ?', [programId]) || 0;
      woCount = queryValue(
        'SELECT COUNT(*) FROM workouts w JOIN mesocycles m ON w.mesocycle_id = m.id WHERE m.program_id = ?',
        [programId]
      ) || 0;
      setCount = queryValue(
        'SELECT COUNT(*) FROM workout_sets s JOIN workouts w ON s.workout_id = w.id JOIN mesocycles m ON w.mesocycle_id = m.id WHERE m.program_id = ?',
        [programId]
      ) || 0;
    } else {
      exGroupCount = queryValue('SELECT COUNT(*) FROM exercise_groups') || 0;
      exCount = queryValue('SELECT COUNT(*) FROM exercises') || 0;
      mesoCount = queryValue('SELECT COUNT(*) FROM mesocycles') || 0;
      woCount = queryValue('SELECT COUNT(*) FROM workouts') || 0;
      setCount = queryValue('SELECT COUNT(*) FROM workout_sets') || 0;
    }

    return {
      programs: queryValue('SELECT COUNT(*) FROM programs') || 0,
      mesocycles: mesoCount,
      workouts: woCount,
      exerciseGroups: exGroupCount,
      exercises: exCount,
      sets: setCount,
    };
  },
};
