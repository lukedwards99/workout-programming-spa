import type { Mesocycle, MesocycleWithWorkoutCount } from '../types/domain';
import type { CreateMesocycleInput, UpdateMesocycleInput } from '../types/api';
import type { SqlRow } from '../types/database';
import { queryAll, queryOne, execSQL, lastInsertRowId } from '../db/databaseService';

function asMesocycle(row: SqlRow): Mesocycle {
  return {
    id: row.id as number,
    name: row.name as string,
    mesocycle_length: row.mesocycle_length as number,
    start_date: row.start_date as string,
    notes: row.notes as string | null,
    sort_order: row.sort_order as number,
  };
}

function asMesocycleWithCount(row: SqlRow): MesocycleWithWorkoutCount {
  return {
    ...asMesocycle(row),
    workout_count: row.workout_count as number,
  };
}

export const mesocyclesApi = {
  list(): MesocycleWithWorkoutCount[] {
    return queryAll(
      `SELECT m.*, (SELECT COUNT(*) FROM workouts WHERE mesocycle_id = m.id) AS workout_count
       FROM mesocycles m ORDER BY m.sort_order, m.start_date`
    ).map(asMesocycleWithCount);
  },
  get(id: number): Mesocycle | null {
    const row = queryOne('SELECT * FROM mesocycles WHERE id = ?', [id]);
    return row ? asMesocycle(row) : null;
  },
  create({ name, mesocycleLength, startDate, notes }: CreateMesocycleInput): Mesocycle | null {
    execSQL(
      'INSERT INTO mesocycles (name, mesocycle_length, start_date, notes) VALUES (?, ?, ?, ?)',
      [name, mesocycleLength || 7, startDate, notes || null]
    );
    return this.get(lastInsertRowId());
  },
  update(id: number, { name, mesocycleLength, startDate, notes }: UpdateMesocycleInput): Mesocycle | null {
    execSQL(
      'UPDATE mesocycles SET name = ?, mesocycle_length = ?, start_date = ?, notes = ? WHERE id = ?',
      [name, mesocycleLength, startDate, notes || null, id]
    );
    return this.get(id);
  },
  delete(id: number): void {
    execSQL('DELETE FROM mesocycles WHERE id = ?', [id]);
  },
};
