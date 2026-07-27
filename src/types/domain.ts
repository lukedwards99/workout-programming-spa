// ── Identity types ──

export type EntityId = number;
export type IsoDate = string;
export type ExerciseType = 'strength' | 'cardio';

// ── Persisted domain rows (matches DDL column names and nullability) ──

export interface Program {
  id: EntityId;
  name: string;
  notes: string | null;
  created_at: string;
}

export interface Mesocycle {
  id: EntityId;
  name: string;
  mesocycle_length: number;
  start_date: IsoDate;
  notes: string | null;
  sort_order: number;
}

export interface Workout {
  id: EntityId;
  mesocycle_id: EntityId;
  name: string;
  day_offset: number;
  notes: string | null;
  sort_order: number;
}

export interface ExerciseGroup {
  id: EntityId;
  name: string;
  notes: string | null;
}

export interface Exercise {
  id: EntityId;
  exercise_group_id: EntityId;
  name: string;
  exercise_type: ExerciseType;
  tutorial_url: string | null;
  notes: string | null;
}

export interface ExerciseVariation {
  id: EntityId;
  exercise_id: EntityId;
  name: string;
  is_primary: number; // SQLite stores boolean as 0/1
  tutorial_url: string | null;
  notes: string | null;
}

export interface WorkoutExercise {
  id: EntityId;
  workout_id: EntityId;
  exercise_id: EntityId;
  exercise_variation_id: EntityId | null;
  exercise_order: number;
}

export type WorkoutSetType = 'warmup' | 'normal' | 'dropset' | 'failure' | 'rest-pause';

export interface StrengthSet {
  id: EntityId;
  workout_exercise_id: EntityId;
  set_number: number;
  set_type: WorkoutSetType;
  planned_reps: number | null;
  actual_reps: number | null;
  weight: number | null;
  rir: number | null;
  notes: string | null;
}

export type CardioDistanceUnit = 'mi' | 'km' | 'm';

export interface CardioSet {
  id: EntityId;
  workout_exercise_id: EntityId;
  set_number: number;
  planned_duration_seconds: number | null;
  actual_duration_seconds: number | null;
  planned_distance: number | null;
  actual_distance: number | null;
  distance_unit: CardioDistanceUnit | null;
  target_rpe: number | null;
  actual_rpe: number | null;
  notes: string | null;
}

// ── Query / view compositions ──

export interface MesocycleWithWorkoutCount extends Mesocycle {
  workout_count: number;
}

export interface ExerciseGroupWithCount extends ExerciseGroup {
  exercise_count: number;
}

export interface ExerciseWithVariations extends Exercise {
  variations: ExerciseVariation[];
}

export interface StrengthSetWithNames extends StrengthSet {
  exercise_name: string;
  variation_name: string | null;
}

export interface CardioSetWithNames extends CardioSet {
  exercise_name: string;
  variation_name: string | null;
}

interface WorkoutExerciseBlockBase {
  workout_exercise_id: EntityId;
  exercise_id: EntityId;
  exercise_name: string;
  exercise_notes: string | null;
  variation_id: EntityId | null;
  variation_name: string | null;
  block_variation_id: number;
  exercise_order: number;
  blockId: string;
}

export interface StrengthExerciseBlock extends WorkoutExerciseBlockBase {
  exercise_type: 'strength';
  sets: StrengthSetWithNames[];
}

export interface CardioExerciseBlock extends WorkoutExerciseBlockBase {
  exercise_type: 'cardio';
  sets: CardioSetWithNames[];
}

export type WorkoutExerciseBlock = StrengthExerciseBlock | CardioExerciseBlock;

export interface ExerciseCopySourceGroup {
  group: ExerciseGroup;
  exercises: Exercise[];
}

// ── Inventory counts (Exercise Library) ──

export interface ProgramSummaryStats {
  mesocycles: number;
  workouts: number;
  exerciseGroups: number;
  exercises: number;
  sets: number;
}

// ── Training Summary contracts ──

export interface SummaryTotals {
  workouts: number;
  distinctExercises: number;
  distinctVariations: number;
  totalSets: number;
  workingSets: number;
  warmupSets: number;
  programmedReps: number;
  programmedVolume: number;
  averageRepsPerWorkingSet: number | null;
  averageRir: number | null;
}

export interface SetTypeSummary {
  setType: WorkoutSetType;
  totalSets: number;
  programmedReps: number;
  programmedVolume: number;
  actualReps: number;
  actualVolume: number;
  averageRir: number | null;
}

export interface ExerciseGroupSummaryRow {
  exerciseGroupId: number;
  exerciseGroupName: string;
  distinctExercises: number;
  totalSets: number;
  workingSets: number;
  programmedReps: number;
  programmedVolume: number;
  actualReps: number;
  actualVolume: number;
  averageRir: number | null;
  workingSetPercentage: number;
  setTypeBreakdown: SetTypeSummary[];
}

export interface ExerciseSummaryRow {
  exerciseId: number;
  exerciseName: string;
  exerciseGroupId: number;
  exerciseGroupName: string;
  totalSets: number;
  workingSets: number;
  programmedReps: number;
  programmedVolume: number;
  actualReps: number;
  actualVolume: number;
  averageRir: number | null;
  workingSetPercentage: number;
  setTypeBreakdown: SetTypeSummary[];
}

export interface ProgramTrainingSummary {
  mesocycles: number;
  totals: SummaryTotals;
  byExerciseGroup: ExerciseGroupSummaryRow[];
  byExercise: ExerciseSummaryRow[];
}

export interface MesocycleTrainingSummary {
  mesocycleId: number;
  mesocycleLength: number;
  totals: SummaryTotals;
  byExerciseGroup: ExerciseGroupSummaryRow[];
  byExercise: ExerciseSummaryRow[];
}

export interface WorkoutTrainingSummary {
  workoutId: number;
  totals: Omit<SummaryTotals, 'workouts'>;
}
