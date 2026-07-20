import type { CardioSession } from '../types/domain';
import type { CreateCardioSessionInput, UpdateCardioSessionInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { execSQL, lastInsertRowId, queryAll, queryOne } from '../db/databaseService';

function asCardioSession(row: SqlRow): CardioSession {
  return {
    id: row.id as number,
    mesocycle_id: row.mesocycle_id as number,
    name: row.name as string,
    modality: row.modality as string,
    day_offset: row.day_offset as number,
    planned_duration_minutes: row.planned_duration_minutes as number,
    planned_distance: row.planned_distance as number | null,
    target_rpe: row.target_rpe as number,
    completed_duration_minutes: row.completed_duration_minutes as number | null,
    completed_distance: row.completed_distance as number | null,
    actual_rpe: row.actual_rpe as number | null,
    notes: row.notes as string | null,
    sort_order: row.sort_order as number,
  };
}

export const cardioSessionsApi = {
  list(mesocycleId: number): CardioSession[] {
    return queryAll('SELECT * FROM cardio_sessions WHERE mesocycle_id = ? ORDER BY day_offset, sort_order, id', [mesocycleId]).map(asCardioSession);
  },
  get(id: number): CardioSession | null {
    const row = queryOne('SELECT * FROM cardio_sessions WHERE id = ?', [id]);
    return row ? asCardioSession(row) : null;
  },
  create(input: CreateCardioSessionInput): CardioSession | null {
    execSQL(
      `INSERT INTO cardio_sessions (mesocycle_id, name, modality, day_offset, planned_duration_minutes, planned_distance, target_rpe, completed_duration_minutes, completed_distance, actual_rpe, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.mesocycleId, input.name, input.modality, input.dayOffset, input.plannedDurationMinutes, input.plannedDistance ?? null, input.targetRpe, input.completedDurationMinutes ?? null, input.completedDistance ?? null, input.actualRpe ?? null, input.notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, input: UpdateCardioSessionInput): CardioSession | null {
    execSQL(
      `UPDATE cardio_sessions SET name = ?, modality = ?, day_offset = ?, planned_duration_minutes = ?, planned_distance = ?, target_rpe = ?, completed_duration_minutes = ?, completed_distance = ?, actual_rpe = ?, notes = ? WHERE id = ?`,
      [input.name, input.modality, input.dayOffset, input.plannedDurationMinutes, input.plannedDistance ?? null, input.targetRpe, input.completedDurationMinutes ?? null, input.completedDistance ?? null, input.actualRpe ?? null, input.notes || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM cardio_sessions WHERE id = ?', [id]);
  },
};
