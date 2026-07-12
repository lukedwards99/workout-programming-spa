import type { EntityId } from '../types/domain';
import type { WorkoutPlan, PlanningAlgorithmId } from '../planning/types';
import { getAlgorithm } from '../planning/algorithmRegistry';
import { execSQL, queryOne } from '../db/databaseService';
import { cloneWorkoutSets } from './workoutsApi';

export interface GeneratedWorkout {
  id: EntityId;
  name: string;
  dayOffset: number;
}

export interface ExecuteResult {
  generated: GeneratedWorkout[];
  totalCopied: number;
}

type ValidDestinationSet = Set<string>;

function buildDestinationSet(copies: WorkoutPlan['copies']): {
  set: ValidDestinationSet;
  duplicates: string[];
} {
  const set = new Set<string>();
  const duplicates: string[] = [];
  for (const c of copies) {
    const key = `${c.sourceWorkoutId}-${c.destinationDayOffset}`;
    if (set.has(key)) {
      duplicates.push(key);
    } else {
      set.add(key);
    }
  }
  return { set, duplicates };
}

/**
 * Applies a pre-computed WorkoutPlan in a single SQLite transaction.
 *
 * All validation (algorithm identity, mesocycle bounds, duplicate detection)
 * runs before BEGIN, so invalid plans perform zero writes.
 * Re-fetches each source inside the transaction to verify it still belongs
 * to the target mesocycle.
 */
export function executeWorkoutPlan(
  plan: WorkoutPlan,
  mesocycleId: number
): ExecuteResult {
  const toCopy = plan.copies;
  if (toCopy.length === 0) {
    return { generated: [], totalCopied: 0 };
  }

  // 1 — Validate algorithm identifier
  const algo = getAlgorithm(plan.algorithmId as PlanningAlgorithmId);
  if (!algo) {
    throw new Error(`Unknown planning algorithm: ${plan.algorithmId}`);
  }

  // 2 — Validate destination bounds
  const mesoRow = queryOne('SELECT mesocycle_length FROM mesocycles WHERE id = ?', [mesocycleId]);
  if (!mesoRow) {
    throw new Error(`Mesocycle ${mesocycleId} not found.`);
  }
  const mesoLength = mesoRow.mesocycle_length as number;

  for (const copy of toCopy) {
    if (!Number.isInteger(copy.destinationDayOffset) || copy.destinationDayOffset < 0) {
      throw new Error(
        `Invalid destination day offset ${copy.destinationDayOffset} for source workout ${copy.sourceWorkoutId}.`
      );
    }
    if (copy.destinationDayOffset >= mesoLength) {
      throw new Error(
        `Destination day ${copy.destinationDayOffset + 1} for source workout ${copy.sourceWorkoutId} is beyond mesocycle length ${mesoLength}.`
      );
    }
  }

  // 3 — Reject duplicate source/destination operations
  const { duplicates } = buildDestinationSet(toCopy);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate source/destination operations in plan: ${duplicates.join(', ')}`
    );
  }

  // 4 — Atomic execution
  execSQL('BEGIN');
  try {
    const generated: GeneratedWorkout[] = [];

    for (const copy of toCopy) {
      const source = queryOne(
        'SELECT * FROM workouts WHERE id = ? AND mesocycle_id = ?',
        [copy.sourceWorkoutId, mesocycleId]
      );

      if (!source) {
        throw new Error(
          `Source workout ${copy.sourceWorkoutId} is no longer in mesocycle ${mesocycleId}.`
        );
      }

      const newId = cloneWorkoutSets(
        {
          id: source.id as number,
          mesocycle_id: source.mesocycle_id as number,
          name: source.name as string,
          day_offset: source.day_offset as number,
          notes: source.notes as string | null,
          sort_order: source.sort_order as number,
        },
        copy.sourceWorkoutName,
        copy.destinationDayOffset
      );

      generated.push({
        id: newId,
        name: copy.sourceWorkoutName,
        dayOffset: copy.destinationDayOffset,
      });
    }

    execSQL('COMMIT');
    return { generated, totalCopied: generated.length };
  } catch (e) {
    execSQL('ROLLBACK');
    throw e;
  }
}
