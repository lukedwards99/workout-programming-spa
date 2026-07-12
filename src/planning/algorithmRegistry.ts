import type { PlanningAlgorithmId, AlgorithmMeta } from './types';

const algorithms: AlgorithmMeta[] = [
  {
    id: 'simple-plan',
    label: 'Simple plan',
    description: 'Repeat one or more completed sample workouts on a fixed schedule.',
    requiresCatalog: false,
  },
];

export function getAlgorithms(): AlgorithmMeta[] {
  return algorithms;
}

export function getAlgorithm(id: PlanningAlgorithmId): AlgorithmMeta | undefined {
  return algorithms.find((a) => a.id === id);
}
