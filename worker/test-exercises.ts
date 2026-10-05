import type { Bindings } from './types';

export function testExercisesEnabled(env: Pick<Bindings, 'APP_ENV'>) {
  return ['local', 'test', 'dev'].includes(env.APP_ENV);
}

const exercises = [
  ['squat', 'Barbell Squat', 'strength', 'Standard'],
  ['bench', 'Barbell Bench Press', 'strength', 'Standard'],
  ['deadlift', 'Deadlift', 'strength', 'Conventional'],
  ['rdl', 'Romanian Deadlift', 'strength', 'Barbell'],
  ['lunge', 'Reverse Lunge', 'strength', 'Dumbbell'],
  ['row', 'Dumbbell Row', 'strength', 'Single arm'],
  ['press', 'Overhead Press', 'strength', 'Standing'],
  ['pulldown', 'Lat Pulldown', 'strength', 'Neutral grip'],
  ['pushup', 'Push-up', 'strength', 'Standard'],
  ['run', 'Running', 'cardio', 'Outdoor'],
  ['bike', 'Stationary Bike', 'cardio', 'Upright'],
  ['rowing', 'Rowing', 'cardio', 'Indoor'],
] as const;

export async function seedTestExercises(db: D1Database, workspaceId: string, userId: string) {
  const statements: D1PreparedStatement[] = [];
  for (const group of ['Strength', 'Cardio']) {
    statements.push(db.prepare(`INSERT INTO exercise_groups (id, workspace_id, name, updated_by_user_id)
      SELECT ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM exercise_groups WHERE workspace_id = ? AND name = ? COLLATE NOCASE
      ) ON CONFLICT DO NOTHING`).bind(`test-library:${workspaceId}:group:${group}`, workspaceId, group, userId, workspaceId, group));
  }
  for (const [key, name, type, variation] of exercises) {
    // Stable IDs also preserve renamed samples when this action is run again.
    const id = `test-library:${workspaceId}:exercise:${key}`;
    const group = type === 'strength' ? 'Strength' : 'Cardio';
    statements.push(db.prepare(`INSERT INTO exercises (id, workspace_id, exercise_group_id, name, exercise_type, updated_by_user_id)
      SELECT ?, ?, (SELECT id FROM exercise_groups WHERE workspace_id = ? AND (name = ? COLLATE NOCASE OR id = ?) ORDER BY id LIMIT 1), ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE workspace_id = ? AND name = ? COLLATE NOCASE AND exercise_type = ?)
      ON CONFLICT(id) DO NOTHING`).bind(id, workspaceId, workspaceId, group, `test-library:${workspaceId}:group:${group}`, name, type, userId, workspaceId, name, type));
    // Only seed variations for our own samples, leaving existing exercises alone.
    statements.push(db.prepare(`INSERT INTO exercise_variations (id, workspace_id, exercise_id, name, is_primary, updated_by_user_id)
      SELECT ?, ?, ?, ?, 1, ? WHERE EXISTS (SELECT 1 FROM exercises WHERE workspace_id = ? AND id = ?)
      AND NOT EXISTS (SELECT 1 FROM exercise_variations WHERE workspace_id = ? AND exercise_id = ?)
      ON CONFLICT(id) DO NOTHING`).bind(`${id}:variation`, workspaceId, id, variation, userId, workspaceId, id, workspaceId, id));
  }
  // D1 batches are transactional, including the duplicate checks above.
  const results = await db.batch(statements);
  return {
    exercisesAdded: results.filter((_, index) => index >= 2 && index % 2 === 0).reduce((sum, result) => sum + result.meta.changes, 0),
  };
}
