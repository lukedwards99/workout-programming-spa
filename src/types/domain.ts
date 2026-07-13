// ── Identity types ──

export type EntityId = number;
export type IsoDate = string;

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

export type WorkoutSetType = 'warmup' | 'normal' | 'dropset' | 'failure' | 'rest-pause';

export interface WorkoutSet {
  id: EntityId;
  workout_id: EntityId;
  exercise_id: EntityId;
  exercise_variation_id: EntityId | null;
  exercise_order: number;
  set_number: number;
  set_type: WorkoutSetType;
  planned_reps: number | null;
  actual_reps: number | null;
  weight: number | null;
  rir: number | null;
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

export interface WorkoutSetWithNames extends WorkoutSet {
  exercise_name: string;
  variation_name: string | null;
}

export interface WorkoutExerciseBlock {
  exercise_id: EntityId;
  exercise_name: string;
  exercise_notes: string | null;
  variation_id: EntityId | null;
  variation_name: string | null;
  block_variation_id: number;
  exercise_order: number;
  blockId: string;
  sets: WorkoutSetWithNames[];
}

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

export interface ExerciseGroupSummaryRow {
  exerciseGroupId: number;
  exerciseGroupName: string;
  distinctExercises: number;
  workingSets: number;
  programmedReps: number;
  programmedVolume: number;
  averageRir: number | null;
  workingSetPercentage: number;
}

export interface ExerciseSummaryRow {
  exerciseId: number;
  exerciseName: string;
  exerciseGroupId: number;
  exerciseGroupName: string;
  workingSets: number;
  programmedReps: number;
  programmedVolume: number;
  averageRir: number | null;
  workingSetPercentage: number;
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
