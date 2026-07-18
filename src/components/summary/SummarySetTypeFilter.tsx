import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { WorkoutSetType } from '../../types/domain';
import { SUMMARY_SET_TYPES, SUMMARY_SET_TYPE_LABELS } from './summarySetTypes';

export { SUMMARY_SET_TYPES } from './summarySetTypes';

interface SummarySetTypeFilterValue {
  selectedSetTypes: WorkoutSetType[];
  toggleSetType: (setType: WorkoutSetType) => void;
}

const SummarySetTypeFilterContext = createContext<SummarySetTypeFilterValue | null>(null);

export function SummarySetTypeFilterProvider({ children }: { children: ReactNode }) {
  const [selectedSetTypes, setSelectedSetTypes] = useState<WorkoutSetType[]>(SUMMARY_SET_TYPES);

  const value = useMemo(() => ({
    selectedSetTypes,
    toggleSetType: (setType: WorkoutSetType) => {
      setSelectedSetTypes((current) => (
        current.includes(setType)
          ? current.filter((type) => type !== setType)
          : [...current, setType]
      ));
    },
  }), [selectedSetTypes]);

  return <SummarySetTypeFilterContext.Provider value={value}>{children}</SummarySetTypeFilterContext.Provider>;
}

export function useSummarySetTypeFilter(): SummarySetTypeFilterValue {
  const value = useContext(SummarySetTypeFilterContext);
  if (!value) throw new Error('Summary set type filter must be used inside its provider.');
  return value;
}

export default function SummarySetTypeFilterControls() {
  const { selectedSetTypes, toggleSetType } = useSummarySetTypeFilter();

  return (
    <fieldset className="summary-set-type-filter" data-testid="summary-set-type-filter">
      <legend>Include set types</legend>
      <div className="summary-set-type-options">
        {SUMMARY_SET_TYPES.map((setType) => (
          <label key={setType}>
            <input
              type="checkbox"
              checked={selectedSetTypes.includes(setType)}
              onChange={() => toggleSetType(setType)}
            />
            {SUMMARY_SET_TYPE_LABELS[setType]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
