import type { ExerciseGroupSummaryRow, ExerciseSummaryRow } from '../../types/domain';
import { formatCount, formatVolume, formatAverage, formatPercentage } from './formatSummary';

interface SummaryBreakdownTablesProps {
  byExerciseGroup: ExerciseGroupSummaryRow[];
  byExercise: ExerciseSummaryRow[];
}

export default function SummaryBreakdownTables({ byExerciseGroup, byExercise }: SummaryBreakdownTablesProps) {
  return (
    <>
      {byExerciseGroup.length > 0 ? (
        <div className="data-card">
          <h2>By Exercise Group</h2>
          <div className="table-responsive">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Exercises</th>
                  <th>Working Sets</th>
                  <th>Programmed Reps</th>
                  <th>Programmed Volume</th>
                  <th>Avg RIR</th>
                  <th>% of Sets</th>
                </tr>
              </thead>
              <tbody>
                {byExerciseGroup.map((row) => (
                  <tr key={`eg-${row.exerciseGroupId}`}>
                    <td data-label="Group">{row.exerciseGroupName}</td>
                    <td data-label="Exercises">{formatCount(row.distinctExercises)}</td>
                    <td data-label="Working Sets">{formatCount(row.workingSets)}</td>
                    <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>
                    <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>
                    <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>
                    <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>
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
          <h2>By Exercise</h2>
          <div className="table-responsive">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Group</th>
                  <th>Working Sets</th>
                  <th>Programmed Reps</th>
                  <th>Programmed Volume</th>
                  <th>Avg RIR</th>
                  <th>% of Sets</th>
                </tr>
              </thead>
              <tbody>
                {byExercise.map((row) => (
                  <tr key={`ex-${row.exerciseId}`}>
                    <td data-label="Exercise">{row.exerciseName}</td>
                    <td data-label="Group">{row.exerciseGroupName}</td>
                    <td data-label="Working Sets">{formatCount(row.workingSets)}</td>
                    <td data-label="Programmed Reps">{formatCount(row.programmedReps)}</td>
                    <td data-label="Programmed Volume">{formatVolume(row.programmedVolume)}</td>
                    <td data-label="Avg RIR">{formatAverage(row.averageRir)}</td>
                    <td data-label="% of Sets">{formatPercentage(row.workingSetPercentage)}</td>
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
