import type { PlanningAlgorithmId } from '../../planning/types';
import { getAlgorithms } from '../../planning/algorithmRegistry';

interface PlanningTypePickerProps {
  selectedId: PlanningAlgorithmId | null;
  onSelect: (id: PlanningAlgorithmId) => void;
}

export default function PlanningTypePicker({ selectedId, onSelect }: PlanningTypePickerProps) {
  const algos = getAlgorithms();

  return (
    <div className="generator-options">
      {algos.map((algo) => (
        <label key={algo.id} className="generator-option">
          <input
            type="radio"
            name="planning-algorithm"
            value={algo.id}
            checked={selectedId === algo.id}
            onChange={() => onSelect(algo.id)}
          />
          <span className="generator-option-body">
            <strong>{algo.label}</strong>
            <small>{algo.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
