import type { WorkoutSetType } from '../../types/domain';

export const SUMMARY_SET_TYPES: WorkoutSetType[] = ['warmup', 'normal', 'dropset', 'failure', 'rest-pause'];

export const SUMMARY_SET_TYPE_LABELS: Record<WorkoutSetType, string> = {
  warmup: 'Warm-up',
  normal: 'Normal',
  dropset: 'Dropset',
  failure: 'Failure',
  'rest-pause': 'Rest-pause',
};
