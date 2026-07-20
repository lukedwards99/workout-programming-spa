import { useEffect, useState } from 'react';
import { Fragment, type ReactNode } from 'react';
import type { ExerciseGroupSummaryRow, ExerciseSummaryRow, SetTypeSummary } from '../../types/domain';
import { formatAverage, formatCount, formatPercentage, formatVolume } from './formatSummary';
import { SUMMARY_SET_TYPE_LABELS } from './summarySetTypes';

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
  { key: 'totalSets', label: 'Selected Sets' },
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
  { key: 'totalSets', label: 'Selected Sets' },
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

function useExpandedRows() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (key: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return { expandedRows, toggleRow };
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
            <input type="checkbox" checked={!hiddenColumns.includes(column.key)} onChange={() => onToggle(column.key)} />
            {column.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function TableHeader({ title, controls }: { title: string; controls: ReactNode }) {
  return <div className="summary-table-header"><h2>{title}</h2>{controls}</div>;
}

function SetTypeBreakdown({ rows }: { rows: SetTypeSummary[] }) {
  return (
    <div className="summary-set-type-breakdown">
      <table aria-label="Set type breakdown">
        <thead>
          <tr>
            <th>Set Type</th>
            <th>Sets</th>
            <th>Programmed Reps</th>
            <th>Programmed Volume</th>
            <th>Actual Reps</th>
            <th>Actual Volume</th>
            <th>Avg RIR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.setType}>
              <td>{SUMMARY_SET_TYPE_LABELS[row.setType]}</td>
              <td>{formatCount(row.totalSets)}</td>
              <td>{formatCount(row.programmedReps)}</td>
              <td>{formatVolume(row.programmedVolume)}</td>
              <td>{formatCount(row.actualReps)}</td>
              <td>{formatVolume(row.actualVolume)}</td>
              <td>{formatAverage(row.averageRir)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ rows, showColumn }: { rows: ExerciseGroupSummaryRow[]; showColumn: (key: string) => boolean }) {
  const { expandedRows, toggleRow } = useExpandedRows();
  const columnCount = 1 + GROUP_COLUMNS.filter((column) => showColumn(column.key)).length;
  return (
    <tbody>
      {rows.map((row) => {
        const rowKey = `eg-${row.exerciseGroupId}`;
        const expanded = expandedRows.has(rowKey);
        return (
          <Fragment key={rowKey}>
            <tr>
              <td data-label="Group">
                <button className="summary-row-toggle" aria-expanded={expanded} onClick={() => toggleRow(rowKey)}>
                  {expanded ? 'Hide' : 'Show'} details: {row.exerciseGroupName}
                </button>
              </td>
              {showColumn('exercises') && <td data-label="Exercises">{formatCount(row.distinctExercises)}</td>}
              {showColumn('totalSets') && <td data-label="Selected Sets">{formatCount(row.totalSets)}</td>}
              {showColumn('workingSets') && <td data-label="Working Sets">{formatCount(row.workingSets)}</td>}
              {showColumn('programmedReps') && <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>}
              {showColumn('programmedVolume') && <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>}
              {showColumn('actualReps') && <td data-label="Actual Reps">{formatCount(row.actualReps)}</td>}
              {showColumn('actualVolume') && <td data-label="Actual Volume">{formatVolume(row.actualVolume)}</td>}
              {showColumn('averageRir') && <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>}
              {showColumn('workingSetPercentage') && <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>}
            </tr>
            {expanded && <tr className="summary-detail-row"><td colSpan={columnCount}><SetTypeBreakdown rows={row.setTypeBreakdown} /></td></tr>}
          </Fragment>
        );
      })}
    </tbody>
  );
}

function ExerciseRows({ rows, showColumn }: { rows: ExerciseSummaryRow[]; showColumn: (key: string) => boolean }) {
  const { expandedRows, toggleRow } = useExpandedRows();
  const columnCount = 1 + EXERCISE_COLUMNS.filter((column) => showColumn(column.key)).length;
  return (
    <tbody>
      {rows.map((row) => {
        const rowKey = `ex-${row.exerciseId}`;
        const expanded = expandedRows.has(rowKey);
        return (
          <Fragment key={rowKey}>
            <tr>
              <td data-label="Exercise">
                <button className="summary-row-toggle" aria-expanded={expanded} onClick={() => toggleRow(rowKey)}>
                  {expanded ? 'Hide' : 'Show'} details: {row.exerciseName}
                </button>
              </td>
              {showColumn('group') && <td data-label="Group">{row.exerciseGroupName}</td>}
              {showColumn('totalSets') && <td data-label="Selected Sets">{formatCount(row.totalSets)}</td>}
              {showColumn('workingSets') && <td data-label="Working Sets">{formatCount(row.workingSets)}</td>}
              {showColumn('programmedReps') && <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>}
              {showColumn('programmedVolume') && <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>}
              {showColumn('actualReps') && <td data-label="Actual Reps">{formatCount(row.actualReps)}</td>}
              {showColumn('actualVolume') && <td data-label="Actual Volume">{formatVolume(row.actualVolume)}</td>}
              {showColumn('averageRir') && <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>}
              {showColumn('workingSetPercentage') && <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>}
            </tr>
            {expanded && <tr className="summary-detail-row"><td colSpan={columnCount}><SetTypeBreakdown rows={row.setTypeBreakdown} /></td></tr>}
          </Fragment>
        );
      })}
    </tbody>
  );
}

export default function SummaryBreakdownTables({ byExerciseGroup, byExercise }: SummaryBreakdownTablesProps) {
  const groupColumns = useHiddenColumns('summary-breakdown-columns:exercise-group');
  const exerciseColumns = useHiddenColumns('summary-breakdown-columns:exercise');
  const showGroupColumn = (key: string) => !groupColumns.hiddenColumns.includes(key);
  const showExerciseColumn = (key: string) => !exerciseColumns.hiddenColumns.includes(key);

  return (
    <>
      <div className="data-card">
        <TableHeader title="By Exercise Group" controls={<ColumnControls columns={GROUP_COLUMNS} hiddenColumns={groupColumns.hiddenColumns} onToggle={groupColumns.toggleColumn} testId="exercise-group-columns" />} />
        {byExerciseGroup.length > 0 ? <div className="table-responsive"><table className="responsive-table"><thead><tr><th>Group</th>{GROUP_COLUMNS.filter((column) => showGroupColumn(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><GroupRows rows={byExerciseGroup} showColumn={showGroupColumn} /></table></div> : <p>No exercise groups match the selected set types.</p>}
      </div>

      <div className="data-card">
        <TableHeader title="By Exercise" controls={<ColumnControls columns={EXERCISE_COLUMNS} hiddenColumns={exerciseColumns.hiddenColumns} onToggle={exerciseColumns.toggleColumn} testId="exercise-columns" />} />
        {byExercise.length > 0 ? <div className="table-responsive"><table className="responsive-table"><thead><tr><th>Exercise</th>{EXERCISE_COLUMNS.filter((column) => showExerciseColumn(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><ExerciseRows rows={byExercise} showColumn={showExerciseColumn} /></table></div> : <p>No exercises match the selected set types.</p>}
      </div>
    </>
  );
}
