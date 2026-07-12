import type { EntityId } from '../types/domain';
import type { PlanningContext, PlannedWorkoutCopy, WorkoutPlan } from './types';

export interface SimplePlanConfig {
  selectedWorkoutIds: EntityId[];
  repeatEveryDays: number;
  totalOccurrences: number;
}

export interface SimplePlanValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSimplePlan(
  config: SimplePlanConfig,
  context: PlanningContext
): SimplePlanValidationResult {
  const errors: string[] = [];

  if (config.selectedWorkoutIds.length === 0) {
    errors.push('Select at least one sample workout.');
  }

  const uniqueIds = new Set(config.selectedWorkoutIds);
  if (uniqueIds.size !== config.selectedWorkoutIds.length) {
    errors.push('Duplicate sample workouts are not allowed.');
  }

  const availableIds = new Set(context.workouts.map((w) => w.id));
  for (const id of config.selectedWorkoutIds) {
    if (!availableIds.has(id)) {
      errors.push(`Selected workout (ID ${id}) does not belong to this mesocycle.`);
    }
  }

  if (!Number.isInteger(config.repeatEveryDays) || config.repeatEveryDays < 1) {
    errors.push('Repeat every X days must be a positive integer.');
  }

  if (!Number.isInteger(config.totalOccurrences) || config.totalOccurrences < 2) {
    errors.push('Total occurrences must be an integer of at least 2.');
  }

  return { valid: errors.length === 0, errors };
}

export function computeSimplePlan(
  config: SimplePlanConfig,
  context: PlanningContext
): WorkoutPlan {
  const selected = context.workouts.filter((w) =>
    config.selectedWorkoutIds.includes(w.id)
  );

  // Stable ordering that matches workout list order (day_offset, then sort_order)
  const ordered = [...selected].sort(
    (a, b) => a.day_offset - b.day_offset || a.sort_order - b.sort_order
  );

  const earliestDay = ordered[0].day_offset;
  const mesoLength = context.mesocycle.mesocycle_length;

  const planCopies: PlannedWorkoutCopy[] = [];
  const planOmitted: PlannedWorkoutCopy[] = [];

  // occurrenceIndex starts at 1 (occurrence 0 is the original)
  for (let occ = 1; occ < config.totalOccurrences; occ++) {
    for (const src of ordered) {
      const normalizedOffset = src.day_offset - earliestDay;
      const destinationDay = earliestDay + normalizedOffset + occ * config.repeatEveryDays;

      const copy: PlannedWorkoutCopy = {
        sourceWorkoutId: src.id,
        sourceWorkoutName: src.name,
        destinationDayOffset: destinationDay,
        occurrence: occ + 1, // 1-based for display
      };

      if (destinationDay >= 0 && destinationDay < mesoLength) {
        planCopies.push(copy);
      } else {
        planOmitted.push(copy);
      }
    }
  }

  return {
    algorithmId: 'simple-plan',
    copies: planCopies,
    omitted: planOmitted,
  };
}

export function maxPossibleOccurrences(
  config: Omit<SimplePlanConfig, 'totalOccurrences'>,
  context: PlanningContext
): number {
  if (
    !Number.isInteger(config.repeatEveryDays) ||
    config.repeatEveryDays < 1
  ) {
    return 0;
  }

  const selected = context.workouts.filter((w) =>
    config.selectedWorkoutIds.includes(w.id)
  );
  if (selected.length === 0) return 0;

  const earliestDay = Math.min(...selected.map((w) => w.day_offset));
  const mesoLength = context.mesocycle.mesocycle_length;

  for (let occ = 1; ; occ++) {
    const destinationDay = earliestDay + occ * config.repeatEveryDays;
    if (destinationDay >= mesoLength) return occ;
  }
}
