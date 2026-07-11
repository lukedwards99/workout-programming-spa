import { openProgramStore, saveProgramStore, saveNow, getCatalogDb } from '../db/databaseService';
import { exerciseGroupsApi } from './exerciseGroupsApi';
import { exercisesApi } from './exercisesApi';
import { exerciseVariationsApi } from './exerciseVariationsApi';

function catalogQueryOne(sql, params = []) {
  const results = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results.length > 0 ? results[0] : null;
}

function catalogQueryAll(sql, params = []) {
  const results = [];
  const stmt = getCatalogDb().prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function readFromStore(db, sql, params = []) {
  const rows = [];
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export const copyApi = {
  async copyExercises(sourceProgramId, targetProgramId, exerciseIds) {
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
      const idMap = {};
      const groupMap = {};

      for (const exId of exerciseIds) {
        const sourceEx = readFromStore(sourceDb, 'SELECT * FROM exercises WHERE id = ?', [exId])[0];
        if (!sourceEx) continue;

        const sourceGroup = readFromStore(sourceDb, 'SELECT * FROM exercise_groups WHERE id = ?', [sourceEx.exercise_group_id])[0];
        if (!sourceGroup) continue;

        // Find or create target group
        if (!groupMap[sourceGroup.id]) {
          let targetGroup = readFromStore(targetDb, 'SELECT * FROM exercise_groups WHERE name = ?', [sourceGroup.name])[0];
          if (!targetGroup) {
            targetDb.run('INSERT INTO exercise_groups (name, notes) VALUES (?, ?)', [sourceGroup.name, sourceGroup.notes]);
            const rowId = targetDb.exec('SELECT last_insert_rowid()')[0].values[0][0];
            targetGroup = { id: Number(rowId) };
          }
          groupMap[sourceGroup.id] = targetGroup.id;
        }
        const targetGroupId = groupMap[sourceGroup.id];

        // Create target exercise
        targetDb.run(
          'INSERT INTO exercises (exercise_group_id, name, tutorial_url, notes) VALUES (?, ?, ?, ?)',
          [targetGroupId, sourceEx.name, sourceEx.tutorial_url, sourceEx.notes]
        );
        const newExId = Number(targetDb.exec('SELECT last_insert_rowid()')[0].values[0][0]);
        idMap[sourceEx.id] = newExId;

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

  getSourceExercises(sourceProgramId) {
    const sourceDbP = openProgramStore(sourceProgramId);
    return sourceDbP.then((sourceDb) => {
      if (!sourceDb) return [];
      sourceDb.run('PRAGMA foreign_keys = ON');
      try {
        const groups = readFromStore(sourceDb, 'SELECT * FROM exercise_groups ORDER BY name');
        return groups.map((g) => {
          const exs = readFromStore(sourceDb, 'SELECT * FROM exercises WHERE exercise_group_id = ? ORDER BY name', [g.id]);
          return { group: g, exercises: exs };
        });
      } finally {
        sourceDb.close();
      }
    });
  },
};
