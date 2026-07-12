import type { Mesocycle, Workout, EntityId } from '../../types/domain';
import type { SimplePlanConfig } from '../../planning/simplePlan';

interface SimplePlanFormProps {
  mesocycle: Mesocycle;
  workouts: Workout[];
  config: SimplePlanConfig;
  errors: string[];
  onConfigChange: (config: SimplePlanConfig) => void;
}

function dayDate(startDate: string, offset: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SimplePlanForm({
  mesocycle,
  workouts,
  config,
  errors,
  onConfigChange,
}: SimplePlanFormProps) {
  const startDate = mesocycle.start_date;

  const toggle = (id: EntityId) => {
    const selected = config.selectedWorkoutIds.includes(id)
      ? config.selectedWorkoutIds.filter((s) => s !== id)
      : [...config.selectedWorkoutIds, id];
    onConfigChange({ ...config, selectedWorkoutIds: selected });
  };

  return (
    <div className="generator-form">
      {errors.length > 0 && (
        <div className="alert alert-danger">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="empty-state">
          <p>No sample workouts exist in this mesocycle.</p>
          <p>Create and fill out workouts first, then return here to generate copies.</p>
        </div>
      ) : (
        <>
          <h3 className="generator-section-title">Sample Workouts</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
            Select one or more existing workouts to use as the template. Their relative day spacing is preserved in each copy.
          </p>

          <div className="generator-checklist">
            {workouts.map((w) => (
              <label key={w.id} className="generator-checklist-item">
                <input
                  type="checkbox"
                  checked={config.selectedWorkoutIds.includes(w.id)}
                  onChange={() => toggle(w.id)}
                />
                <span className="generator-checklist-body">
                  <strong>{w.name}</strong>
                  <small>Day {w.day_offset + 1} &mdash; {dayDate(startDate, w.day_offset)}</small>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="generator-fields">
        <div className="form-group">
          <label htmlFor="gen-repeat-days">Repeat every (days)</label>
          <input
            id="gen-repeat-days"
            type="number"
            min={1}
            value={config.repeatEveryDays}
            onChange={(e) =>
              onConfigChange({
                ...config,
                repeatEveryDays: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="gen-total-occurrences">Total occurrences (including sample)</label>
          <input
            id="gen-total-occurrences"
            type="number"
            min={2}
            value={config.totalOccurrences}
            onChange={(e) =>
              onConfigChange({
                ...config,
                totalOccurrences: Number(e.target.value),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
