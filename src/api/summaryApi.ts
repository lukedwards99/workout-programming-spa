import type {
  ExerciseGroupSummaryRow,
  ExerciseSummaryRow,
  MesocycleTrainingSummary,
  ProgramSummaryStats,
  ProgramTrainingSummary,
  SetTypeSummary,
  WorkoutSetType,
  WorkoutTrainingSummary,
} from '../types/domain';
import type { SqlParams, SqlRow } from '../types/database';
import { queryAll, queryOne, queryValue } from '../db/databaseService';
import { SUMMARY_SET_TYPES } from '../components/summary/summarySetTypes';

function asNumber(value: unknown): number {
  return Number(value) || 0;
}

function asNullNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function typeFilter(selectedSetTypes: WorkoutSetType[], column = 'ws.set_type') {
  if (selectedSetTypes.length === 0) return { sql: '1 = 0', params: [] as SqlParams };
  return {
    sql: `${column} IN (${selectedSetTypes.map(() => '?').join(', ')})`,
    params: selectedSetTypes as SqlParams,
  };
}

function mapSetTypeSummary(row: SqlRow): SetTypeSummary {
  return {
    setType: row.set_type as WorkoutSetType,
    totalSets: asNumber(row.total_sets),
    programmedReps: asNumber(row.programmed_reps),
    programmedVolume: asNumber(row.programmed_volume),
    actualReps: asNumber(row.actual_reps),
    actualVolume: asNumber(row.actual_volume),
    averageRir: asNullNumber(row.average_rir),
  };
}

function groupSetTypeRows(rows: SqlRow[], selectedSetTypes: WorkoutSetType[], key: string): Map<number, SetTypeSummary[]> {
  const summaries = new Map<number, Map<WorkoutSetType, SetTypeSummary>>();
  rows.forEach((row) => {
    const id = asNumber(row[key]);
    const byType = summaries.get(id) ?? new Map<WorkoutSetType, SetTypeSummary>();
    byType.set(row.set_type as WorkoutSetType, mapSetTypeSummary(row));
    summaries.set(id, byType);
  });

  return new Map([...summaries.entries()].map(([id, byType]) => [
    id,
    selectedSetTypes.map((setType) => byType.get(setType) ?? {
      setType,
      totalSets: 0,
      programmedReps: 0,
      programmedVolume: 0,
      actualReps: 0,
      actualVolume: 0,
      averageRir: null,
    }),
  ]));
}

function mapGroupRow(row: SqlRow, scopeSets: number, setTypeBreakdown: SetTypeSummary[]): ExerciseGroupSummaryRow {
  const workingSets = asNumber(row.working_sets);
  const totalSets = asNumber(row.total_sets);
  return {
    exerciseGroupId: asNumber(row.exercise_group_id),
    exerciseGroupName: row.exercise_group_name as string,
    distinctExercises: asNumber(row.distinct_exercises),
    totalSets,
    workingSets,
    programmedReps: asNumber(row.programmed_reps),
    programmedVolume: asNumber(row.programmed_volume),
    actualReps: asNumber(row.actual_reps),
    actualVolume: asNumber(row.actual_volume),
    averageRir: asNullNumber(row.average_rir),
    workingSetPercentage: scopeSets > 0 ? totalSets / scopeSets : 0,
    setTypeBreakdown,
  };
}

function mapExerciseRow(row: SqlRow, scopeSets: number, setTypeBreakdown: SetTypeSummary[]): ExerciseSummaryRow {
  const workingSets = asNumber(row.working_sets);
  const totalSets = asNumber(row.total_sets);
  return {
    exerciseId: asNumber(row.exercise_id),
    exerciseName: row.exercise_name as string,
    exerciseGroupId: asNumber(row.exercise_group_id),
    exerciseGroupName: row.exercise_group_name as string,
    totalSets,
    workingSets,
    programmedReps: asNumber(row.programmed_reps),
    programmedVolume: asNumber(row.programmed_volume),
    actualReps: asNumber(row.actual_reps),
    actualVolume: asNumber(row.actual_volume),
    averageRir: asNullNumber(row.average_rir),
    workingSetPercentage: scopeSets > 0 ? totalSets / scopeSets : 0,
    setTypeBreakdown,
  };
}

function parseSummaryTotals(row: SqlRow, includeWorkouts: boolean) {
  const programmedReps = asNumber(row.programmed_reps);
  const setsWithPlannedReps = asNumber(row.sets_with_planned_reps);
  return {
    workouts: includeWorkouts ? asNumber(row.workouts) : 0,
    distinctExercises: asNumber(row.distinct_exercises),
    distinctVariations: asNumber(row.distinct_variations),
    totalSets: asNumber(row.total_sets),
    workingSets: asNumber(row.working_sets),
    warmupSets: asNumber(row.warmup_sets),
    programmedReps,
    programmedVolume: asNumber(row.programmed_volume),
    averageRepsPerWorkingSet: setsWithPlannedReps > 0 ? programmedReps / setsWithPlannedReps : null,
    averageRir: asNullNumber(row.average_rir),
  };
}

const TOTALS_COMMON = `
  COUNT(DISTINCT ws.exercise_id) as distinct_exercises,
  COUNT(DISTINCT ws.exercise_variation_id) as distinct_variations,
  COALESCE(COUNT(ws.id), 0) as total_sets,
  COALESCE(SUM(CASE WHEN ws.set_type <> 'warmup' THEN 1 ELSE 0 END), 0) as working_sets,
  COALESCE(SUM(CASE WHEN ws.set_type = 'warmup' THEN 1 ELSE 0 END), 0) as warmup_sets,
  COALESCE(SUM(COALESCE(ws.planned_reps, 0)), 0) as programmed_reps,
  COALESCE(SUM(COALESCE(ws.planned_reps, 0) * COALESCE(ws.weight, 0)), 0) as programmed_volume,
  COALESCE(SUM(COALESCE(ws.actual_reps, 0)), 0) as actual_reps,
  COALESCE(SUM(COALESCE(ws.actual_reps, 0) * COALESCE(ws.weight, 0)), 0) as actual_volume,
  COUNT(CASE WHEN ws.planned_reps IS NOT NULL THEN 1 END) as sets_with_planned_reps,
  AVG(CASE WHEN ws.rir IS NOT NULL THEN ws.rir END) as average_rir
`;

const BREAKDOWN_GROUP_COMMON = `
  eg.id as exercise_group_id,
  eg.name as exercise_group_name,
  COUNT(DISTINCT e.id) as distinct_exercises,
  ${TOTALS_COMMON}
`;

const BREAKDOWN_EXERCISE_COMMON = `
  e.id as exercise_id,
  e.name as exercise_name,
  eg.id as exercise_group_id,
  eg.name as exercise_group_name,
  ${TOTALS_COMMON}
`;

const SET_TYPE_METRICS = `
  COALESCE(COUNT(ws.id), 0) as total_sets,
  COALESCE(SUM(COALESCE(ws.planned_reps, 0)), 0) as programmed_reps,
  COALESCE(SUM(COALESCE(ws.planned_reps, 0) * COALESCE(ws.weight, 0)), 0) as programmed_volume,
  COALESCE(SUM(COALESCE(ws.actual_reps, 0)), 0) as actual_reps,
  COALESCE(SUM(COALESCE(ws.actual_reps, 0) * COALESCE(ws.weight, 0)), 0) as actual_volume,
  AVG(CASE WHEN ws.rir IS NOT NULL THEN ws.rir END) as average_rir
`;

const GROUP_JOIN = `
  FROM workout_sets ws
  JOIN exercises e ON e.id = ws.exercise_id
  JOIN exercise_groups eg ON eg.id = e.exercise_group_id
`;

function buildBreakdowns(
  groupRows: SqlRow[],
  exerciseRows: SqlRow[],
  selectedSetTypes: WorkoutSetType[],
) {
  return {
    groups: groupSetTypeRows(groupRows, selectedSetTypes, 'exercise_group_id'),
    exercises: groupSetTypeRows(exerciseRows, selectedSetTypes, 'exercise_id'),
  };
}

export const summaryApi = {
  getStats(): ProgramSummaryStats {
    return {
      mesocycles: asNumber(queryValue('SELECT COUNT(*) FROM mesocycles')),
      workouts: asNumber(queryValue('SELECT COUNT(*) FROM workouts')),
      exerciseGroups: asNumber(queryValue('SELECT COUNT(*) FROM exercise_groups')),
      exercises: asNumber(queryValue('SELECT COUNT(*) FROM exercises')),
      sets: asNumber(queryValue('SELECT COUNT(*) FROM workout_sets')),
    };
  },

  getProgramSummary(selectedSetTypes: WorkoutSetType[] = SUMMARY_SET_TYPES): ProgramTrainingSummary {
    const filter = typeFilter(selectedSetTypes);
    const totals = parseSummaryTotals(queryOne(`
      SELECT COUNT(DISTINCT wo.id) as workouts, ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id AND ${filter.sql}
    `, filter.params) ?? {}, true);

    const groupRows = queryAll(`
      SELECT ${BREAKDOWN_GROUP_COMMON}
      ${GROUP_JOIN}
      WHERE ${filter.sql}
      GROUP BY eg.id, eg.name
      ORDER BY total_sets DESC, programmed_reps DESC, eg.name ASC
    `, filter.params);
    const exerciseRows = queryAll(`
      SELECT ${BREAKDOWN_EXERCISE_COMMON}
      ${GROUP_JOIN}
      WHERE ${filter.sql}
      GROUP BY e.id, e.name, eg.id, eg.name
      ORDER BY total_sets DESC, programmed_reps DESC, e.name ASC
    `, filter.params);
    const groupSetTypes = queryAll(`
      SELECT eg.id as exercise_group_id, ws.set_type, ${SET_TYPE_METRICS}
      ${GROUP_JOIN}
      WHERE ${filter.sql}
      GROUP BY eg.id, ws.set_type
    `, filter.params);
    const exerciseSetTypes = queryAll(`
      SELECT e.id as exercise_id, ws.set_type, ${SET_TYPE_METRICS}
      ${GROUP_JOIN}
      WHERE ${filter.sql}
      GROUP BY e.id, ws.set_type
    `, filter.params);
    const breakdowns = buildBreakdowns(groupSetTypes, exerciseSetTypes, selectedSetTypes);

    return {
      mesocycles: asNumber(queryValue('SELECT COUNT(*) FROM mesocycles')),
      totals,
      byExerciseGroup: groupRows.map((row) => mapGroupRow(row, totals.totalSets, breakdowns.groups.get(asNumber(row.exercise_group_id)) ?? [])),
      byExercise: exerciseRows.map((row) => mapExerciseRow(row, totals.totalSets, breakdowns.exercises.get(asNumber(row.exercise_id)) ?? [])),
    };
  },

  getMesocycleSummary(mesocycleId: number, selectedSetTypes: WorkoutSetType[] = SUMMARY_SET_TYPES): MesocycleTrainingSummary | null {
    const mesocycle = queryOne('SELECT id, mesocycle_length FROM mesocycles WHERE id = ?', [mesocycleId]);
    if (!mesocycle) return null;
    const filter = typeFilter(selectedSetTypes);
    const totals = parseSummaryTotals(queryOne(`
      SELECT COUNT(DISTINCT wo.id) as workouts, ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id AND ${filter.sql}
      WHERE wo.mesocycle_id = ?
    `, [...filter.params, mesocycleId]) ?? {}, true);

    const scopeWhere = `WHERE wo.mesocycle_id = ? AND ${filter.sql}`;
    const scopeParams = [mesocycleId, ...filter.params];
    const groupRows = queryAll(`
      SELECT ${BREAKDOWN_GROUP_COMMON}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      ${scopeWhere}
      GROUP BY eg.id, eg.name
      ORDER BY total_sets DESC, programmed_reps DESC, eg.name ASC
    `, scopeParams);
    const exerciseRows = queryAll(`
      SELECT ${BREAKDOWN_EXERCISE_COMMON}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      ${scopeWhere}
      GROUP BY e.id, e.name, eg.id, eg.name
      ORDER BY total_sets DESC, programmed_reps DESC, e.name ASC
    `, scopeParams);
    const groupSetTypes = queryAll(`
      SELECT eg.id as exercise_group_id, ws.set_type, ${SET_TYPE_METRICS}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      ${scopeWhere}
      GROUP BY eg.id, ws.set_type
    `, scopeParams);
    const exerciseSetTypes = queryAll(`
      SELECT e.id as exercise_id, ws.set_type, ${SET_TYPE_METRICS}
      ${GROUP_JOIN}
      JOIN workouts wo ON wo.id = ws.workout_id
      ${scopeWhere}
      GROUP BY e.id, ws.set_type
    `, scopeParams);
    const breakdowns = buildBreakdowns(groupSetTypes, exerciseSetTypes, selectedSetTypes);

    return {
      mesocycleId,
      mesocycleLength: asNumber(mesocycle.mesocycle_length),
      totals,
      byExerciseGroup: groupRows.map((row) => mapGroupRow(row, totals.totalSets, breakdowns.groups.get(asNumber(row.exercise_group_id)) ?? [])),
      byExercise: exerciseRows.map((row) => mapExerciseRow(row, totals.totalSets, breakdowns.exercises.get(asNumber(row.exercise_id)) ?? [])),
    };
  },

  getWorkoutSummary(workoutId: number, selectedSetTypes: WorkoutSetType[] = SUMMARY_SET_TYPES): WorkoutTrainingSummary | null {
    const workout = queryOne('SELECT id FROM workouts WHERE id = ?', [workoutId]);
    if (!workout) return null;
    const filter = typeFilter(selectedSetTypes);
    const totals = parseSummaryTotals(queryOne(`
      SELECT ${TOTALS_COMMON}
      FROM workouts wo
      LEFT JOIN workout_sets ws ON ws.workout_id = wo.id AND ${filter.sql}
      WHERE wo.id = ?
    `, [...filter.params, workoutId]) ?? {}, false);

    const { workouts: _workouts, ...workoutTotals } = totals;
    return { workoutId, totals: workoutTotals };
  },
};
