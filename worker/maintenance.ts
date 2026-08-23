const workspaceHistoryTables = [
  'workspaces_history', 'workspace_members_history', 'coach_client_relationships_history',
  'programs_history', 'program_members_history', 'program_assignments_history',
  'mesocycles_history', 'workouts_history', 'exercise_groups_history', 'exercises_history',
  'exercise_variations_history', 'workout_exercises_history', 'strength_sets_history',
  'cardio_sets_history', 'workout_sessions_history', 'strength_set_results_history',
  'cardio_set_results_history', 'audit_events_history',
] as const;

const globalHistoryTables = [
  'users_history', 'auth_identities_history', 'platform_user_roles_history',
] as const;

export async function runHistoryRetention(db: D1Database) {
  const results: Record<string, number> = {};
  for (const table of workspaceHistoryTables) {
    const workspaceColumn = table === 'workspaces_history' ? 'id' : 'workspace_id';
    const result = await db.prepare(
      `DELETE FROM ${table}
       WHERE history_recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now',
         '-' || COALESCE((SELECT history_retention_days FROM workspaces w WHERE w.id = ${table}.${workspaceColumn}), 365) || ' days')
       AND NOT EXISTS (
         SELECT 1 FROM workspaces w WHERE w.id = ${table}.${workspaceColumn} AND w.legal_hold_at IS NOT NULL
       )`,
    ).run();
    results[table] = result.meta.changes ?? 0;
  }
  for (const table of globalHistoryTables) {
    const result = await db.prepare(
      `DELETE FROM ${table}
       WHERE history_recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 days')`,
    ).run();
    results[table] = result.meta.changes ?? 0;
  }
  return results;
}

