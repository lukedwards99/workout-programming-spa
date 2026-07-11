import type { ExerciseGroup, Exercise, ExerciseCopySourceGroup } from '../types/domain';
import type { CopyResult } from '../types/api';
import type { SqlRow, SqlValue } from '../types/database';
import { openProgramStore, saveProgramStore, saveNow, getCatalogDb } from '../db/databaseService';
import { exerciseGroupsApi } from './exerciseGroupsApi';
import { exercisesApi } from './exercisesApi';
import { exerciseVariationsApi } from './exerciseVariationsApi';

type Database = import('sql.js').Database;

function catalogQueryOne(sql: string, params: SqlValue[] = []): SqlRow | null {
  const results: SqlRow[] = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results.length > 0 ? results[0] : null;
}

function catalogQueryAll(sql: string, params: SqlValue[] = []): SqlRow[] {
  const results: SqlRow[] = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function readFromStore(db: Database, sql: string, params: SqlValue[] = []): SqlRow[] {
  const rows: SqlRow[] = [];
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function asExerciseGroup(row: SqlRow): ExerciseGroup {
  return {
    id: row.id as number,
    name: row.name as string,
    notes: row.notes as string | null,
  };
}

function asExercise(row: SqlRow): Exercise {
  return {
    id: row.id as number,
    exercise_group_id: row.exercise_group_id as number,
    name: row.name as string,
    tutorial_url: row.tutorial_url as string | null,
    notes: row.notes as string | null,
  };
}

export const copyApi = {
  async copyExercises(sourceProgramId: number, targetProgramId: number, exerciseIds: number[]): Promise<CopyResult> {
    const sourceDb = await openProgramStore(sourceProgramId);
    if (!sourceDb) throw new Error('Source program store not found.');
    sourceDb.run('PRAGMA foreign_keys = ON');

    const targetDb = await openProgramStore(targetProgramId);
    if (!targetDb) {
      sourceDb.close();
      throw new Error('Target program store not found.');
    }
    targetDb.run('PRAGMA foreign_keys = ON');

    try {
      const idMap: CopyResult = {};
      const groupMap: Record<number, number> = {};

      for (const exId of exerciseIds) {
        const sourceEx = readFromStore(sourceDb, 'SELECT * FROM exercises WHERE id = ?', [exId])[0];
        if (!sourceEx) continue;

        const sourceGroup = readFromStore(sourceDb, 'SELECT * FROM exercise_groups WHERE id = ?', [sourceEx.exercise_group_id])[0];
        if (!sourceGroup) continue;

        // Find or create target group
        if (!groupMap[sourceGroup.id as number]) {
          let targetGroup = readFromStore(targetDb, 'SELECT * FROM exercise_groups WHERE name = ?', [sourceGroup.name])[0];
          if (!targetGroup) {
            targetDb.run('INSERT INTO exercise_groups (name, notes) VALUES (?, ?)', [sourceGroup.name, sourceGroup.notes]);
            const rowId = targetDb.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
            targetGroup = { id: Number(rowId) } as SqlRow;
          }
          groupMap[sourceGroup.id as number] = targetGroup.id as number;
        }
        const targetGroupId = groupMap[sourceGroup.id as number];

        // Create target exercise
        targetDb.run(
          'INSERT INTO exercises (exercise_group_id, name, tutorial_url, notes) VALUES (?, ?, ?, ?)',
          [targetGroupId, sourceEx.name, sourceEx.tutorial_url, sourceEx.notes]
        );
        const newExId = Number(targetDb.exec('SELECT last_insert_rowid()')[0].values[0][0]);
        idMap[sourceEx.id as number] = newExId;

        // Copy variations
        const variations = readFromStore(sourceDb, 'SELECT * FROM exercise_variations WHERE exercise_id = ?', [sourceEx.id]);
        for (const v of variations) {
          targetDb.run(
            'INSERT INTO exercise_variations (exercise_id, name, is_primary, tutorial_url, notes) VALUES (?, ?, ?, ?, ?)',
            [newExId, v.name, v.is_primary, v.tutorial_url, v.notes]
          );
        }
      }

      // Save the target program store
      await saveProgramStore(targetProgramId, targetDb);

      return idMap;
    } finally {
      sourceDb.close();
      targetDb.close();
    }
  },

  getSourceExercises(sourceProgramId: number): Promise<ExerciseCopySourceGroup[]> {
    const sourceDbP = openProgramStore(sourceProgramId);
    return sourceDbP.then((sourceDb) => {
      if (!sourceDb) return [];
      sourceDb.run('PRAGMA foreign_keys = ON');
      try {
        const groups = readFromStore(sourceDb, 'SELECT * FROM exercise_groups ORDER BY name');
        return groups.map((g) => {
          const exs = readFromStore(sourceDb, 'SELECT * FROM exercises WHERE exercise_group_id = ? ORDER BY name', [g.id]).map(asExercise);
          return { group: asExerciseGroup(g), exercises: exs };
        });
      } finally {
        sourceDb.close();
      }
    });
  },
};
