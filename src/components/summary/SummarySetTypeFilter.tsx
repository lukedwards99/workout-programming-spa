import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import type { WorkoutSetType } from '../../types/domain';
import { SUMMARY_SET_TYPES, SUMMARY_SET_TYPE_LABELS } from './summarySetTypes';

export { SUMMARY_SET_TYPES } from './summarySetTypes';

interface SummarySetTypeFilterValue {
  selectedSetTypes: WorkoutSetType[];
  toggleSetType: (setType: WorkoutSetType) => void;
}

interface SummarySetTypeFilterControlsProps {
  ariaLabel?: string;
  testId?: string;
  compact?: boolean;
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

export default function SummarySetTypeFilterControls({
  ariaLabel = 'Set types included in summary',
  testId = 'summary-set-type-filter',
  compact = false,
}: SummarySetTypeFilterControlsProps) {
  const { selectedSetTypes, toggleSetType } = useSummarySetTypeFilter();
  const instanceId = useId().replace(/:/g, '');

  return (
    <fieldset className={`summary-set-type-filter${compact ? ' summary-set-type-filter-compact' : ''}`} data-testid={testId} aria-label={ariaLabel}>
      <legend>Set types</legend>
      <div className="summary-set-type-options">
        {SUMMARY_SET_TYPES.map((setType) => {
          const inputId = `summary-set-type-${instanceId}-${setType}`;
          const selected = selectedSetTypes.includes(setType);
          return (
            <div className="summary-set-type-option" key={setType}>
              <input
                id={inputId}
                type="checkbox"
                checked={selected}
                onChange={() => toggleSetType(setType)}
              />
              <label className={`summary-set-type-chip set-type-${setType}${selected ? ' is-selected' : ''}`} htmlFor={inputId}>
                <span className="summary-set-type-check" aria-hidden="true">✓</span>
                {SUMMARY_SET_TYPE_LABELS[setType]}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
