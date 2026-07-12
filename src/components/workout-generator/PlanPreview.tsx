import type { Mesocycle } from '../../types/domain';
import type { WorkoutPlan } from '../../planning/types';

interface PlanPreviewProps {
  mesocycle: Mesocycle;
  plan: WorkoutPlan;
}

function dayDate(startDate: string, offset: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PlanPreview({ mesocycle, plan }: PlanPreviewProps) {
  const inRange = plan.copies.length;
  const omitted = plan.omitted.length;
  const total = inRange + omitted;

  if (total === 0) {
    return (
      <div className="generator-preview empty-state">
        <p>
          No copies to preview. Adjust your selection, occurrences, or repeat interval so at least
          one copy falls within the {mesocycle.mesocycle_length}-day mesocycle.
        </p>
      </div>
    );
  }

  // Group by occurrence for display
  const grouped: Record<number, typeof plan.copies> = {};
  for (const c of plan.copies) {
    if (!grouped[c.occurrence]) grouped[c.occurrence] = [];
    grouped[c.occurrence].push(c);
  }
  for (const c of plan.omitted) {
    if (!grouped[c.occurrence]) grouped[c.occurrence] = [];
    grouped[c.occurrence].push(c);
  }

  const sortedOccurrences = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="generator-preview">
      <h3 className="generator-section-title">Preview</h3>

      <div className="generator-preview-summary">
        {inRange > 0 && (
          <span>
            <strong>{inRange}</strong> workout{inRange !== 1 ? 's' : ''} will be added.
          </span>
        )}
        {omitted > 0 && (
          <span>
            {' '}
            <strong>{omitted}</strong> requested workout{omitted !== 1 ? 's' : ''} fall outside
            this mesocycle and will be skipped.
          </span>
        )}
        <small>Existing workouts on destination days are preserved.</small>
      </div>

      <div className="generator-preview-table-wrap">
        <table className="generator-preview-table">
          <thead>
            <tr>
              <th>Occurrence</th>
              <th>Workout</th>
              <th>Day</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedOccurrences.map((occ) => {
              const items = grouped[occ];
              return items.map((c, i) => {
                const isOmitted = plan.omitted.some(
                  (o) =>
                    o.sourceWorkoutId === c.sourceWorkoutId &&
                    o.destinationDayOffset === c.destinationDayOffset
                );
                return (
                  <tr key={`${c.sourceWorkoutId}-${c.destinationDayOffset}`} className={isOmitted ? 'generator-omitted' : ''}>
                    {i === 0 && <td rowSpan={items.length}>{occ}</td>}
                    <td>{c.sourceWorkoutName}</td>
                    <td>{c.destinationDayOffset + 1}</td>
                    <td>{dayDate(mesocycle.start_date, c.destinationDayOffset)}</td>
                    <td>{isOmitted ? 'Omitted' : ''}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
