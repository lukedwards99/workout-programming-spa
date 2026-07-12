import type { ProgramSummaryStats, ProgramTrainingSummary, MesocycleTrainingSummary, WorkoutTrainingSummary, ExerciseGroupSummaryRow, ExerciseSummaryRow } from '../types/domain';
import type { SqlRow } from '../types/database';
import { queryValue, queryAll, queryOne } from '../db/databaseService';

function asNumber(v: unknown): number {
  return (v as number) || 0;
}

function asNullNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapGroupRow(r: SqlRow, scopeWorkingSets: number): ExerciseGroupSummaryRow {
  const workingSets = asNumber(r.working_sets);
  return {
    exerciseGroupId: r.exercise_group_id as number,
    exerciseGroupName: r.exercise_group_name as string,
    distinctExercises: asNumber(r.distinct_exercises),
    workingSets,
    programmedReps: asNumber(r.programmed_reps),
    programmedVolume: asNumber(r.programmed_volume),
    averageRir: asNullNumber(r.average_rir),
    workingSetPercentage: scopeWorkingSets > 0 ? workingSets / scopeWorkingSets : 0,
  };
}

function mapExerciseRow(r: SqlRow, scopeWorkingSets: number): ExerciseSummaryRow {
  const workingSets = asNumber(r.working_sets);
  return {
    exerciseId: r.exercise_id as number,
    exerciseName: r.exercise_name as string,
    exerciseGroupId: r.exercise_group_id as number,
    exerciseGroupName: r.exercise_group_name as string,
    workingSets,
    programmedReps: asNumber(r.programmed_reps),
    programmedVolume: asNumber(r.programmed_volume),
    averageRir: asNullNumber(r.average_rir),
    workingSetPercentage: scopeWorkingSets > 0 ? workingSets / scopeWorkingSets : 0,
  };
}

function parseSummaryTotals(row: SqlRow, includeWorkouts: boolean) {
  const workouts = includeWorkouts ? asNumber(row.workouts) : 0;
  const distinctExercises = asNumber(row.distinct_exercises);
  const distinctVariations = asNumber(row.distinct_variations);
  const totalSets = asNumber(row.total_sets);
  const workingSets = asNumber(row.working_sets);
  const warmupSets = asNumber(row.warmup_sets);
  const programmedReps = asNumber(row.programmed_reps);
  const programmedVolume = asNumber(row.programmed_volume);
  const workingSetsWithReps = asNumber(row.working_sets_with_reps);
  const averageRir = asNullNumber(row.average_rir);

  const averageRepsPerWorkingSet = workingSetsWithReps > 0
    ? programmedReps / workingSetsWithReps
    : null;

  return {
    workouts,
    distinctExercises,
    distinctVariations,
    totalSets,
    workingSets,
    warmupSets,
    programmedReps,
    programmedVolume,
    averageRepsPerWorkingSet,
    averageRir,
  };
}

const TOTALS_COMMON = `
  COUNT(DISTINCT ws.exercise_id) as distinct_exercises,
  COUNT(DISTINCT ws.exercise_variation_id) as distinct_variations,
  COALESCE(COUNT(ws.id), 0) as total_sets,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END), 0) as working_sets,
  COALESCE(SUM(CASE WHEN ws.set_type = 'warmup' THEN 1 ELSE 0 END), 0) as warmup_sets,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) ELSE 0 END), 0) as programmed_reps,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) * COALESCE(ws.weight, 0) ELSE 0 END), 0) as programmed_volume,
  COUNT(CASE WHEN ws.set_type <> 'warmup' AND ws.reps IS NOT NULL THEN 1 END) as working_sets_with_reps,
  AVG(CASE WHEN ws.set_type <> 'warmup' AND ws.rir IS NOT NULL THEN ws.rir END) as average_rir
`;

const BREAKDOWN_GROUP_COMMON = `
  eg.id as exercise_group_id,
  eg.name as exercise_group_name,
  COUNT(DISTINCT e.id) as distinct_exercises,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END), 0) as working_sets,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) ELSE 0 END), 0) as programmed_reps,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) * COALESCE(ws.weight, 0) ELSE 0 END), 0) as programmed_volume,
  AVG(CASE WHEN ws.set_type <> 'warmup' AND ws.rir IS NOT NULL THEN ws.rir END) as average_rir
`;

const BREAKDOWN_EX_COMMON = `
  e.id as exercise_id,
  e.name as exercise_name,
  eg.id as exercise_group_id,
  eg.name as exercise_group_name,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END), 0) as working_sets,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) ELSE 0 END), 0) as programmed_reps,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN COALESCE(ws.reps, 0) * COALESCE(ws.weight, 0) ELSE 0 END), 0) as programmed_volume,
  AVG(CASE WHEN ws.set_type <> 'warmup' AND ws.rir IS NOT NULL THEN ws.rir END) as average_rir
`;

const GROUP_JOIN = `
  FROM workout_sets ws
  JOIN exercises e ON e.id = ws.exercise_id
  JOIN exercise_groups eg ON eg.id = e.exercise_group_id
`;

export const summaryApi = {
  getStats(): ProgramSummaryStats {
    const exGroupCount = asNumber(queryValue('SELECT COUNT(*) FROM exercise_groups'));
    const exCount = asNumber(queryValue('SELECT COUNT(*) FROM exercises'));
    const mesoCount = asNumber(queryValue('SELECT COUNT(*) FROM mesocycles'));
    const woCount = asNumber(queryValue('SELECT COUNT(*) FROM workouts'));
    const setCount = asNumber(queryValue('SELECT COUNT(*) FROM workout_sets'));

    return {
      mesocycles: mesoCount,
      workouts: woCount,
      exerciseGroups: exGroupCount,
      exercises: exCount,
      sets: setCount,
    };
  },

  getProgramSummary(): ProgramTrainingSummary {
    const totalsRow = queryOne(`
      SELECT
        COUNT(DISTINCT wo.id) as workouts,
        ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id
    `);

    const totals = parseSummaryTotals(totalsRow ?? {}, true);
    const mesocycles = asNumber(queryValue('SELECT COUNT(*) FROM mesocycles'));

    const groupRows = queryAll(`
      SELECT ${BREAKDOWN_GROUP_COMMON}
      ${GROUP_JOIN}
      GROUP BY eg.id, eg.name
      HAVING SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END) > 0
      ORDER BY working_sets DESC, programmed_reps DESC, eg.name ASC
    `);

    const exRows = queryAll(`
      SELECT ${BREAKDOWN_EX_COMMON}
      ${GROUP_JOIN}
      GROUP BY e.id, e.name, eg.id, eg.name
      HAVING SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END) > 0
      ORDER BY working_sets DESC, programmed_reps DESC, e.name ASC
    `);

    return {
      mesocycles,
      totals,
      byExerciseGroup: groupRows.map((r) => mapGroupRow(r, totals.workingSets)),
      byExercise: exRows.map((r) => mapExerciseRow(r, totals.workingSets)),
    };
  },

  getMesocycleSummary(mesocycleId: number): MesocycleTrainingSummary | null {
    const meso = queryOne('SELECT id, mesocycle_length FROM mesocycles WHERE id = ?', [mesocycleId]);
    if (!meso) return null;

    const totalsRow = queryOne(`
      SELECT
        COUNT(DISTINCT wo.id) as workouts,
        ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id
      WHERE wo.mesocycle_id = ?
    `, [mesocycleId]);

    const totals = parseSummaryTotals(totalsRow ?? {}, true);

    const groupRows = queryAll(`
      SELECT ${BREAKDOWN_GROUP_COMMON}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      WHERE wo.mesocycle_id = ?
      GROUP BY eg.id, eg.name
      HAVING SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END) > 0
      ORDER BY working_sets DESC, programmed_reps DESC, eg.name ASC
    `, [mesocycleId]);

    const exRows = queryAll(`
      SELECT ${BREAKDOWN_EX_COMMON}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      WHERE wo.mesocycle_id = ?
      GROUP BY e.id, e.name, eg.id, eg.name
      HAVING SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END) > 0
      ORDER BY working_sets DESC, programmed_reps DESC, e.name ASC
    `, [mesocycleId]);

    return {
      mesocycleId,
      mesocycleLength: meso.mesocycle_length as number,
      totals,
      byExerciseGroup: groupRows.map((r) => mapGroupRow(r, totals.workingSets)),
      byExercise: exRows.map((r) => mapExerciseRow(r, totals.workingSets)),
    };
  },

  getWorkoutSummary(workoutId: number): WorkoutTrainingSummary | null {
    const wo = queryOne('SELECT id FROM workouts WHERE id = ?', [workoutId]);
    if (!wo) return null;

    const totalsRow = queryOne(`
      SELECT
        ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id
      WHERE wo.id = ?
    `, [workoutId]);

    const totals = parseSummaryTotals(totalsRow ?? {}, false);

    return {
      workoutId,
      totals: {
        distinctExercises: totals.distinctExercises,
        distinctVariations: totals.distinctVariations,
        totalSets: totals.totalSets,
        workingSets: totals.workingSets,
        warmupSets: totals.warmupSets,
        programmedReps: totals.programmedReps,
        programmedVolume: totals.programmedVolume,
        averageRepsPerWorkingSet: totals.averageRepsPerWorkingSet,
        averageRir: totals.averageRir,
      },
    };
  },
};
