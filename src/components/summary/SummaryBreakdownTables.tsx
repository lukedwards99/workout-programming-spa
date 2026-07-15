import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExerciseGroupSummaryRow, ExerciseSummaryRow } from '../../types/domain';
import { formatCount, formatVolume, formatAverage, formatPercentage } from './formatSummary';

interface SummaryBreakdownTablesProps {
  byExerciseGroup: ExerciseGroupSummaryRow[];
  byExercise: ExerciseSummaryRow[];
}

interface ColumnDefinition {
  key: string;
  label: string;
}

const GROUP_COLUMNS: ColumnDefinition[] = [
  { key: 'exercises', label: 'Exercises' },
  { key: 'workingSets', label: 'Working Sets' },
  { key: 'programmedReps', label: 'Programmed Reps' },
  { key: 'programmedVolume', label: 'Programmed Volume' },
  { key: 'actualReps', label: 'Actual Reps' },
  { key: 'actualVolume', label: 'Actual Volume' },
  { key: 'averageRir', label: 'Avg RIR' },
  { key: 'workingSetPercentage', label: '% of Sets' },
];

const EXERCISE_COLUMNS: ColumnDefinition[] = [
  { key: 'group', label: 'Group' },
  { key: 'workingSets', label: 'Working Sets' },
  { key: 'programmedReps', label: 'Programmed Reps' },
  { key: 'programmedVolume', label: 'Programmed Volume' },
  { key: 'actualReps', label: 'Actual Reps' },
  { key: 'actualVolume', label: 'Actual Volume' },
  { key: 'averageRir', label: 'Avg RIR' },
  { key: 'workingSetPercentage', label: '% of Sets' },
];

function readHiddenColumns(storageKey: string): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((key) => typeof key === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function useHiddenColumns(storageKey: string) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => readHiddenColumns(storageKey));

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(hiddenColumns));
    } catch {
      // Column preferences are optional and should not prevent rendering.
    }
  }, [hiddenColumns, storageKey]);

  const toggleColumn = (key: string) => {
    setHiddenColumns((current) => (
      current.includes(key)
        ? current.filter((column) => column !== key)
        : [...current, key]
    ));
  };

  return { hiddenColumns, toggleColumn };
}

interface ColumnControlsProps {
  columns: ColumnDefinition[];
  hiddenColumns: string[];
  onToggle: (key: string) => void;
  testId: string;
}

function ColumnControls({ columns, hiddenColumns, onToggle, testId }: ColumnControlsProps) {
  return (
    <details className="summary-column-controls" data-testid={testId}>
      <summary>Columns</summary>
      <div className="summary-column-options">
        {columns.map((column) => (
          <label key={column.key}>
            <input
              type="checkbox"
              checked={!hiddenColumns.includes(column.key)}
              onChange={() => onToggle(column.key)}
            />
            {column.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function TableHeader({ title, controls }: { title: string; controls: ReactNode }) {
  return (
    <div className="summary-table-header">
      <h2>{title}</h2>
      {controls}
    </div>
  );
}

export default function SummaryBreakdownTables({ byExerciseGroup, byExercise }: SummaryBreakdownTablesProps) {
  const groupColumns = useHiddenColumns('summary-breakdown-columns:exercise-group');
  const exerciseColumns = useHiddenColumns('summary-breakdown-columns:exercise');
  const showGroupColumn = (key: string) => !groupColumns.hiddenColumns.includes(key);
  const showExerciseColumn = (key: string) => !exerciseColumns.hiddenColumns.includes(key);

  return (
    <>
      {byExerciseGroup.length > 0 ? (
        <div className="data-card">
          <TableHeader
            title="By Exercise Group"
            controls={<ColumnControls columns={GROUP_COLUMNS} hiddenColumns={groupColumns.hiddenColumns} onToggle={groupColumns.toggleColumn} testId="exercise-group-columns" />}
          />
          <div className="table-responsive">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Group</th>
                  {showGroupColumn('exercises') && <th>Exercises</th>}
                  {showGroupColumn('workingSets') && <th>Working Sets</th>}
                  {showGroupColumn('programmedReps') && <th>Programmed Reps</th>}
                  {showGroupColumn('programmedVolume') && <th>Programmed Volume</th>}
                  {showGroupColumn('actualReps') && <th>Actual Reps</th>}
                  {showGroupColumn('actualVolume') && <th>Actual Volume</th>}
                  {showGroupColumn('averageRir') && <th>Avg RIR</th>}
                  {showGroupColumn('workingSetPercentage') && <th>% of Sets</th>}
                </tr>
              </thead>
              <tbody>
                {byExerciseGroup.map((row) => (
                  <tr key={`eg-${row.exerciseGroupId}`}>
                    <td data-label="Group">{row.exerciseGroupName}</td>
                    {showGroupColumn('exercises') && <td data-label="Exercises">{formatCount(row.distinctExercises)}</td>}
                    {showGroupColumn('workingSets') && <td data-label="Working Sets">{formatCount(row.workingSets)}</td>}
                    {showGroupColumn('programmedReps') && <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>}
                    {showGroupColumn('programmedVolume') && <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>}
                    {showGroupColumn('actualReps') && <td data-label="Actual Reps">{formatCount(row.actualReps)}</td>}
                    {showGroupColumn('actualVolume') && <td data-label="Actual Volume">{formatVolume(row.actualVolume)}</td>}
                    {showGroupColumn('averageRir') && <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>}
                    {showGroupColumn('workingSetPercentage') && <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="data-card">
          <h2>By Exercise Group</h2>
          <p>No exercise groups with working sets.</p>
        </div>
      )}

      {byExercise.length > 0 ? (
        <div className="data-card">
          <TableHeader
            title="By Exercise"
            controls={<ColumnControls columns={EXERCISE_COLUMNS} hiddenColumns={exerciseColumns.hiddenColumns} onToggle={exerciseColumns.toggleColumn} testId="exercise-columns" />}
          />
          <div className="table-responsive">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  {showExerciseColumn('group') && <th>Group</th>}
                  {showExerciseColumn('workingSets') && <th>Working Sets</th>}
                  {showExerciseColumn('programmedReps') && <th>Programmed Reps</th>}
                  {showExerciseColumn('programmedVolume') && <th>Programmed Volume</th>}
                  {showExerciseColumn('actualReps') && <th>Actual Reps</th>}
                  {showExerciseColumn('actualVolume') && <th>Actual Volume</th>}
                  {showExerciseColumn('averageRir') && <th>Avg RIR</th>}
                  {showExerciseColumn('workingSetPercentage') && <th>% of Sets</th>}
                </tr>
              </thead>
              <tbody>
                {byExercise.map((row) => (
                  <tr key={`ex-${row.exerciseId}`}>
                    <td data-label="Exercise">{row.exerciseName}</td>
                    {showExerciseColumn('group') && <td data-label="Group">{row.exerciseGroupName}</td>}
                    {showExerciseColumn('workingSets') && <td data-label="Working Sets">{formatCount(row.workingSets)}</td>}
                    {showExerciseColumn('programmedReps') && <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>}
                    {showExerciseColumn('programmedVolume') && <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>}
                    {showExerciseColumn('actualReps') && <td data-label="Actual Reps">{formatCount(row.actualReps)}</td>}
                    {showExerciseColumn('actualVolume') && <td data-label="Actual Volume">{formatVolume(row.actualVolume)}</td>}
                    {showExerciseColumn('averageRir') && <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>}
                    {showExerciseColumn('workingSetPercentage') && <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="data-card">
          <h2>By Exercise</h2>
          <p>No exercises with working sets.</p>
        </div>
      )}
    </>
  );
}
