import type { CardioTrainingSummary } from '../../types/domain';

function distance(value: number): string { return value ? `${value.toFixed(1)} mi` : '—'; }

export default function CardioSummary({ data, showMesocycle = false }: { data: CardioTrainingSummary; showMesocycle?: boolean }) {
  const { totals, sessions } = data;
  return (
    <>
      <div className="stats-grid" aria-label="Cardio summary">
        <div className="stat-card"><span className="label">Sessions</span><span className="val">{totals.sessions}</span></div>
        <div className="stat-card"><span className="label">Planned Minutes</span><span className="val">{totals.plannedDurationMinutes}</span></div>
        <div className="stat-card"><span className="label">Completed Minutes</span><span className="val">{totals.completedDurationMinutes}</span></div>
        <div className="stat-card"><span className="label">Planned Distance</span><span className="val">{distance(totals.plannedDistance)}</span></div>
        <div className="stat-card"><span className="label">Completed Distance</span><span className="val">{distance(totals.completedDistance)}</span></div>
      </div>
      {sessions.length === 0 ? <div className="empty-state"><p>No cardio sessions are programmed yet.</p></div> : (
        <div className="table-responsive"><table className="responsive-table"><thead><tr>
          {showMesocycle && <th>Mesocycle</th>}<th>Session</th><th>Modality</th><th>Day</th><th>Planned</th><th>Completed</th><th>RPE</th>
        </tr></thead><tbody>{sessions.map((session) => <tr key={session.id}>
          {showMesocycle && <td data-label="Mesocycle">{session.mesocycle_name}</td>}<td data-label="Session"><strong>{session.name}</strong></td>
          <td data-label="Modality">{session.modality}</td><td data-label="Day">{session.day_offset + 1}</td>
          <td data-label="Planned">{session.planned_duration_minutes} min{session.planned_distance != null ? ` · ${distance(session.planned_distance)}` : ''}</td>
          <td data-label="Completed">{session.completed_duration_minutes ?? '—'}{session.completed_duration_minutes != null ? ' min' : ''}{session.completed_distance != null ? ` · ${distance(session.completed_distance)}` : ''}</td>
          <td data-label="RPE">{session.target_rpe}{session.actual_rpe != null ? ` → ${session.actual_rpe}` : ''}</td>
        </tr>)}</tbody></table></div>
      )}
    </>
  );
}
