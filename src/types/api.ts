import type {
  CardioDistanceUnit,
  EntityId,
  ExerciseType,
  IsoDate,
  ProgramSummaryStats,
  WorkoutSetType,
} from './domain';

// ── Program ──

export interface CreateProgramInput {
  name: string;
  notes?: string;
}

export interface UpdateProgramInput {
  name: string;
  notes?: string;
}

// ── Mesocycle ──

export interface CreateMesocycleInput {
  name: string;
  mesocycleLength?: number;
  startDate: IsoDate;
  notes?: string;
}

export interface UpdateMesocycleInput {
  name: string;
  mesocycleLength: number;
  startDate: IsoDate;
  notes?: string;
}

// ── Workout ──

export interface CreateWorkoutInput {
  mesocycleId: EntityId;
  name: string;
  dayOffset: number;
  notes?: string;
}

export interface UpdateWorkoutInput {
  name: string;
  dayOffset: number;
  notes?: string;
}

export interface CopyWorkoutInput {
  name: string;
  dayOffset: number;
}

// ── Workout Exercise ──

export interface CreateWorkoutExerciseInput {
  workoutId: EntityId;
  exerciseId: EntityId;
  exerciseVariationId?: EntityId | null;
  exerciseOrder: number;
}

// ── Strength Set ──

export interface CreateStrengthSetInput {
  workoutExerciseId: EntityId;
  setNumber: number;
  setType?: WorkoutSetType;
  plannedReps?: number | null;
  actualReps?: number | null;
  weight?: number | null;
  rir?: number | null;
  notes?: string;
}

export interface UpdateStrengthSetInput {
  set_type?: WorkoutSetType;
  set_number?: number;
  planned_reps?: number | null;
  actual_reps?: number | null;
  weight?: number | null;
  rir?: number | null;
  notes?: string;
}

// ── Cardio Set ──

export interface CreateCardioSetInput {
  workoutExerciseId: EntityId;
  setNumber: number;
  plannedDurationSeconds?: number | null;
  actualDurationSeconds?: number | null;
  plannedDistance?: number | null;
  actualDistance?: number | null;
  distanceUnit?: CardioDistanceUnit | null;
  targetRpe?: number | null;
  actualRpe?: number | null;
  notes?: string;
}

export interface UpdateCardioSetInput {
  set_number?: number;
  planned_duration_seconds?: number | null;
  actual_duration_seconds?: number | null;
  planned_distance?: number | null;
  actual_distance?: number | null;
  distance_unit?: CardioDistanceUnit | null;
  target_rpe?: number | null;
  actual_rpe?: number | null;
  notes?: string;
}

// ── Exercise Group ──

export interface CreateExerciseGroupInput {
  name: string;
  notes?: string;
}

export interface UpdateExerciseGroupInput {
  name: string;
  notes?: string;
}

// ── Exercise ──

export interface CreateExerciseInput {
  groupId: EntityId;
  name: string;
  exerciseType?: ExerciseType;
  tutorialUrl?: string;
  notes?: string;
}

export interface UpdateExerciseInput {
  groupId: EntityId;
  name: string;
  exerciseType: ExerciseType;
  tutorialUrl?: string;
  notes?: string;
}

// ── Exercise Variation ──

export interface CreateExerciseVariationInput {
  exerciseId: EntityId;
  name: string;
  isPrimary?: boolean;
  tutorialUrl?: string;
  notes?: string;
}

export interface UpdateExerciseVariationInput {
  name: string;
  isPrimary?: boolean;
  tutorialUrl?: string;
  notes?: string;
}

// ── Backup / Import ──

export interface BackupMetadata {
  program_name?: string;
  program_notes?: string;
  program_created_at?: string;
  format_version?: string;
  backup_type?: string;
  source_program_id?: string;
  exported_at?: string;
  folder_backup_id?: string;
  folder_backup_filename?: string;
  [key: string]: string | undefined;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  meta?: BackupMetadata;
}

// ── Exercise JSON Export/Import ──

export interface ExportedExerciseVariation {
  name: string;
  isPrimary?: boolean;
  tutorialUrl?: string;
  notes?: string;
}

export interface ExportedExercise {
  name: string;
  exerciseType: ExerciseType;
  tutorialUrl?: string;
  notes?: string;
  groupName?: string;
  variations?: ExportedExerciseVariation[];
}

export interface ExportedExerciseGroup {
  name: string;
  notes?: string;
}

export interface ExerciseJSONExport {
  version: number;
  type: string;
  exportedAt: string;
  program: {
    name: string;
    notes: string;
  };
  exerciseGroups: ExportedExerciseGroup[];
  exercises: ExportedExercise[];
}

// ── Copy ──

export interface CopyResult {
  [sourceExerciseId: EntityId]: EntityId;
}

// ── Summary (re-export for convenience) ──

export type { ProgramSummaryStats };
