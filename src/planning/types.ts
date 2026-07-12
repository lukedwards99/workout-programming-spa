import type { EntityId, Mesocycle, Workout, ExerciseGroup, Exercise } from '../types/domain';

export type PlanningAlgorithmId = 'simple-plan';

export interface PlanningContext {
  mesocycle: Mesocycle;
  workouts: Workout[];
  exerciseGroups: ExerciseGroup[];
  exercises: Exercise[];
}

export interface PlannedWorkoutCopy {
  sourceWorkoutId: EntityId;
  sourceWorkoutName: string;
  destinationDayOffset: number;
  occurrence: number;
}

export interface WorkoutPlan {
  algorithmId: PlanningAlgorithmId;
  copies: PlannedWorkoutCopy[];
  omitted: PlannedWorkoutCopy[];
}

export interface AlgorithmMeta {
  id: PlanningAlgorithmId;
  label: string;
  description: string;
  requiresCatalog: boolean;
}
