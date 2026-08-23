import fs from 'node:fs/promises';

const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const audit = [
  ['created_at', `TEXT NOT NULL DEFAULT (${now})`],
  ['updated_at', `TEXT NOT NULL DEFAULT (${now})`],
  ['updated_by_user_id', 'TEXT'],
];

const table = (name, columns, options = {}) => ({
  name,
  columns: [...columns, ...audit],
  constraints: options.constraints ?? [],
  indexes: options.indexes ?? [],
  historyKey: options.historyKey ?? ['id'],
});

const tables = [
  table('users', [
    ['id', 'TEXT PRIMARY KEY'],
    ['email_normalized', 'TEXT NOT NULL'],
    ['email_display', 'TEXT NOT NULL'],
    ['display_name', 'TEXT NOT NULL'],
    ['status', "TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','disabled'))"],
  ], {
    constraints: ['UNIQUE(email_normalized)'],
    indexes: [['idx_users_status', 'status']],
  }),
  table('auth_identities', [
    ['id', 'TEXT PRIMARY KEY'],
    ['user_id', 'TEXT NOT NULL'],
    ['provider', 'TEXT NOT NULL'],
    ['provider_subject', 'TEXT NOT NULL'],
    ['email_at_link', 'TEXT NOT NULL'],
    ['last_seen_at', 'TEXT'],
  ], {
    constraints: [
      'UNIQUE(provider, provider_subject)',
      'UNIQUE(user_id, provider)',
      'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE',
    ],
    indexes: [['idx_auth_identities_user', 'user_id']],
  }),
  table('platform_user_roles', [
    ['user_id', 'TEXT NOT NULL'],
    ['role', "TEXT NOT NULL CHECK(role IN ('admin'))"],
  ], {
    constraints: [
      'PRIMARY KEY(user_id, role)',
      'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE',
    ],
    historyKey: ['user_id', 'role'],
  }),
  table('workspaces', [
    ['id', 'TEXT PRIMARY KEY'],
    ['name', 'TEXT NOT NULL'],
    ['status', "TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended'))"],
    ['history_retention_days', 'INTEGER NOT NULL DEFAULT 365 CHECK(history_retention_days > 0)'],
    ['legal_hold_at', 'TEXT'],
    ['legal_hold_reason', 'TEXT'],
    ['legal_hold_by_user_id', 'TEXT'],
  ], {
    constraints: ["CHECK(legal_hold_at IS NULL OR (legal_hold_reason IS NOT NULL AND legal_hold_by_user_id IS NOT NULL))"],
    indexes: [['idx_workspaces_status', 'status']],
  }),
  table('workspace_members', [
    ['workspace_id', 'TEXT NOT NULL'],
    ['user_id', 'TEXT NOT NULL'],
    ['role', "TEXT NOT NULL CHECK(role IN ('owner','coach','client'))"],
    ['status', "TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended'))"],
    ['joined_at', `TEXT NOT NULL DEFAULT (${now})`],
  ], {
    constraints: [
      'PRIMARY KEY(workspace_id, user_id)',
      'FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
      'FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT',
    ],
    indexes: [['idx_workspace_members_user', 'user_id, status']],
    historyKey: ['workspace_id', 'user_id'],
  }),
  table('coach_client_relationships', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['coach_user_id', 'TEXT NOT NULL'],
    ['client_user_id', 'TEXT NOT NULL'],
    ['status', "TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused'))"],
  ], {
    constraints: [
      'UNIQUE(workspace_id, coach_user_id, client_user_id)',
      'CHECK(coach_user_id <> client_user_id)',
      'FOREIGN KEY(workspace_id, coach_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, client_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE',
    ],
    indexes: [
      ['idx_coach_clients_coach', 'workspace_id, coach_user_id, status'],
      ['idx_coach_clients_client', 'workspace_id, client_user_id, status'],
    ],
  }),
  table('programs', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['owner_user_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['notes', 'TEXT'],
    ['kind', "TEXT NOT NULL DEFAULT 'personal' CHECK(kind IN ('personal','template','assigned'))"],
    ['status', "TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','completed'))"],
    ['visibility', "TEXT NOT NULL DEFAULT 'current' CHECK(visibility IN ('current','archived'))"],
    ['revision', 'INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, id)',
      "CHECK(visibility = 'current' OR status = 'completed')",
      'FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, owner_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT',
    ],
    indexes: [['idx_programs_workspace_owner', 'workspace_id, owner_user_id, visibility, status']],
  }),
  table('program_members', [
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['user_id', 'TEXT NOT NULL'],
    ['access_level', "TEXT NOT NULL CHECK(access_level IN ('editor','athlete','viewer'))"],
  ], {
    constraints: [
      'PRIMARY KEY(workspace_id, program_id, user_id)',
      'FOREIGN KEY(workspace_id, program_id) REFERENCES programs(workspace_id, id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE',
    ],
    indexes: [['idx_program_members_user', 'workspace_id, user_id, access_level']],
    historyKey: ['workspace_id', 'program_id', 'user_id'],
  }),
  table('program_assignments', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['source_program_id', 'TEXT'],
    ['assigned_program_id', 'TEXT NOT NULL'],
    ['coach_user_id', 'TEXT NOT NULL'],
    ['client_user_id', 'TEXT NOT NULL'],
    ['source_revision', 'INTEGER CHECK(source_revision >= 1)'],
    ['status', "TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed'))"],
    ['starts_on', 'TEXT'],
    ['ends_on', 'TEXT'],
    ['assigned_at', `TEXT NOT NULL DEFAULT (${now})`],
    ['completed_at', 'TEXT'],
  ], {
    constraints: [
      'UNIQUE(assigned_program_id)',
      'CHECK(coach_user_id <> client_user_id)',
      'FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
      'FOREIGN KEY(source_program_id) REFERENCES programs(id) ON DELETE SET NULL',
      'FOREIGN KEY(assigned_program_id) REFERENCES programs(id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, coach_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT',
      'FOREIGN KEY(workspace_id, client_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT',
    ],
    indexes: [
      ['idx_assignments_client', 'workspace_id, client_user_id, status'],
      ['idx_assignments_coach', 'workspace_id, coach_user_id, status'],
      ['idx_assignments_source', 'source_program_id, source_revision'],
    ],
  }),
  table('mesocycles', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['mesocycle_length', 'INTEGER NOT NULL DEFAULT 7 CHECK(mesocycle_length > 0)'],
    ['start_date', 'TEXT NOT NULL'],
    ['notes', 'TEXT'],
    ['sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'FOREIGN KEY(workspace_id, program_id) REFERENCES programs(workspace_id, id) ON DELETE CASCADE',
    ],
    indexes: [['idx_mesocycles_program_order', 'workspace_id, program_id, sort_order, start_date']],
  }),
  table('workouts', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['mesocycle_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['day_offset', 'INTEGER NOT NULL CHECK(day_offset >= 0)'],
    ['notes', 'TEXT'],
    ['sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'FOREIGN KEY(workspace_id, program_id, mesocycle_id) REFERENCES mesocycles(workspace_id, program_id, id) ON DELETE CASCADE',
    ],
    indexes: [['idx_workouts_mesocycle_order', 'workspace_id, program_id, mesocycle_id, sort_order']],
  }),
  table('exercise_groups', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['notes', 'TEXT'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, id)',
      'UNIQUE(workspace_id, name)',
      'FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE',
    ],
    indexes: [['idx_exercise_groups_workspace_name', 'workspace_id, name']],
  }),
  table('exercises', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['exercise_group_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['exercise_type', "TEXT NOT NULL DEFAULT 'strength' CHECK(exercise_type IN ('strength','cardio'))"],
    ['tutorial_url', 'TEXT'],
    ['notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, id)',
      'FOREIGN KEY(workspace_id, exercise_group_id) REFERENCES exercise_groups(workspace_id, id) ON DELETE CASCADE',
    ],
    indexes: [
      ['idx_exercises_group_name', 'workspace_id, exercise_group_id, name'],
      ['idx_exercises_type', 'workspace_id, exercise_type'],
    ],
  }),
  table('exercise_variations', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['exercise_id', 'TEXT NOT NULL'],
    ['name', 'TEXT NOT NULL'],
    ['is_primary', 'INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1))'],
    ['tutorial_url', 'TEXT'],
    ['notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, exercise_id, id)',
      'FOREIGN KEY(workspace_id, exercise_id) REFERENCES exercises(workspace_id, id) ON DELETE CASCADE',
    ],
    indexes: [['idx_variations_exercise', 'workspace_id, exercise_id, is_primary']],
  }),
  table('workout_exercises', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_id', 'TEXT NOT NULL'],
    ['exercise_id', 'TEXT NOT NULL'],
    ['exercise_variation_id', 'TEXT'],
    ['exercise_order', 'INTEGER NOT NULL CHECK(exercise_order >= 0)'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'UNIQUE(workspace_id, program_id, workout_id, exercise_order)',
      'FOREIGN KEY(workspace_id, program_id, workout_id) REFERENCES workouts(workspace_id, program_id, id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, exercise_id) REFERENCES exercises(workspace_id, id) ON DELETE RESTRICT',
      'FOREIGN KEY(workspace_id, exercise_id, exercise_variation_id) REFERENCES exercise_variations(workspace_id, exercise_id, id) ON DELETE RESTRICT',
    ],
    indexes: [
      ['idx_workout_exercises_workout', 'workspace_id, program_id, workout_id, exercise_order'],
      ['idx_workout_exercises_exercise', 'workspace_id, exercise_id'],
    ],
  }),
  table('strength_sets', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_exercise_id', 'TEXT NOT NULL'],
    ['set_number', 'INTEGER NOT NULL CHECK(set_number >= 1)'],
    ['set_type', "TEXT NOT NULL DEFAULT 'normal' CHECK(set_type IN ('warmup','normal','dropset','failure','rest-pause'))"],
    ['planned_reps', 'INTEGER CHECK(planned_reps >= 0)'],
    ['planned_weight', 'REAL CHECK(planned_weight >= 0)'],
    ['target_rir', 'INTEGER CHECK(target_rir >= 0)'],
    ['coach_notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'UNIQUE(workspace_id, program_id, workout_exercise_id, set_number)',
      'FOREIGN KEY(workspace_id, program_id, workout_exercise_id) REFERENCES workout_exercises(workspace_id, program_id, id) ON DELETE CASCADE',
    ],
    indexes: [['idx_strength_sets_block', 'workspace_id, program_id, workout_exercise_id, set_number']],
  }),
  table('cardio_sets', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_exercise_id', 'TEXT NOT NULL'],
    ['set_number', 'INTEGER NOT NULL CHECK(set_number >= 1)'],
    ['planned_duration_seconds', 'INTEGER CHECK(planned_duration_seconds >= 0)'],
    ['planned_distance', 'REAL CHECK(planned_distance >= 0)'],
    ['distance_unit', "TEXT CHECK(distance_unit IN ('mi','km','m'))"],
    ['target_rpe', 'INTEGER CHECK(target_rpe BETWEEN 1 AND 10)'],
    ['coach_notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'UNIQUE(workspace_id, program_id, workout_exercise_id, set_number)',
      'CHECK(planned_distance IS NULL OR distance_unit IS NOT NULL)',
      'FOREIGN KEY(workspace_id, program_id, workout_exercise_id) REFERENCES workout_exercises(workspace_id, program_id, id) ON DELETE CASCADE',
    ],
    indexes: [['idx_cardio_sets_block', 'workspace_id, program_id, workout_exercise_id, set_number']],
  }),
  table('workout_sessions', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_id', 'TEXT NOT NULL'],
    ['athlete_user_id', 'TEXT NOT NULL'],
    ['attempt_number', 'INTEGER NOT NULL DEFAULT 1 CHECK(attempt_number >= 1)'],
    ['status', "TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','skipped'))"],
    ['scheduled_for', 'TEXT'],
    ['started_at', 'TEXT'],
    ['completed_at', 'TEXT'],
    ['athlete_notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workspace_id, program_id, id)',
      'UNIQUE(workspace_id, program_id, workout_id, athlete_user_id, attempt_number)',
      'FOREIGN KEY(workspace_id, program_id, workout_id) REFERENCES workouts(workspace_id, program_id, id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, athlete_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT',
    ],
    indexes: [
      ['idx_sessions_athlete_date', 'workspace_id, athlete_user_id, scheduled_for, status'],
      ['idx_sessions_program_status', 'workspace_id, program_id, status'],
    ],
  }),
  table('strength_set_results', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_session_id', 'TEXT NOT NULL'],
    ['strength_set_id', 'TEXT NOT NULL'],
    ['actual_reps', 'INTEGER CHECK(actual_reps >= 0)'],
    ['actual_weight', 'REAL CHECK(actual_weight >= 0)'],
    ['actual_rir', 'INTEGER CHECK(actual_rir >= 0)'],
    ['athlete_notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workout_session_id, strength_set_id)',
      'FOREIGN KEY(workspace_id, program_id, workout_session_id) REFERENCES workout_sessions(workspace_id, program_id, id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, program_id, strength_set_id) REFERENCES strength_sets(workspace_id, program_id, id) ON DELETE RESTRICT',
    ],
    indexes: [['idx_strength_results_session', 'workspace_id, program_id, workout_session_id']],
  }),
  table('cardio_set_results', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT NOT NULL'],
    ['program_id', 'TEXT NOT NULL'],
    ['workout_session_id', 'TEXT NOT NULL'],
    ['cardio_set_id', 'TEXT NOT NULL'],
    ['actual_duration_seconds', 'INTEGER CHECK(actual_duration_seconds >= 0)'],
    ['actual_distance', 'REAL CHECK(actual_distance >= 0)'],
    ['actual_rpe', 'INTEGER CHECK(actual_rpe BETWEEN 1 AND 10)'],
    ['athlete_notes', 'TEXT'],
    ['version', 'INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1)'],
  ], {
    constraints: [
      'UNIQUE(workout_session_id, cardio_set_id)',
      'FOREIGN KEY(workspace_id, program_id, workout_session_id) REFERENCES workout_sessions(workspace_id, program_id, id) ON DELETE CASCADE',
      'FOREIGN KEY(workspace_id, program_id, cardio_set_id) REFERENCES cardio_sets(workspace_id, program_id, id) ON DELETE RESTRICT',
    ],
    indexes: [['idx_cardio_results_session', 'workspace_id, program_id, workout_session_id']],
  }),
  table('audit_events', [
    ['id', 'TEXT PRIMARY KEY'],
    ['workspace_id', 'TEXT'],
    ['program_id', 'TEXT'],
    ['actor_user_id', 'TEXT'],
    ['action', 'TEXT NOT NULL'],
    ['resource_type', 'TEXT NOT NULL'],
    ['resource_id', 'TEXT'],
    ['subject_user_id', 'TEXT'],
    ['metadata_json', 'TEXT'],
  ], {
    indexes: [
      ['idx_audit_workspace_time', 'workspace_id, created_at'],
      ['idx_audit_resource', 'resource_type, resource_id, created_at'],
      ['idx_audit_actor', 'actor_user_id, created_at'],
    ],
  }),
];

function createBase(t) {
  const definitions = [
    ...t.columns.map(([name, ddl]) => `  ${name} ${ddl}`),
    ...t.constraints.map((constraint) => `  ${constraint}`),
  ];
  return `CREATE TABLE ${t.name} (\n${definitions.join(',\n')}\n);`;
}

function createHistory(t) {
  const names = t.columns.map(([name]) => name);
  const sourceKey = t.historyKey.join(', ');
  const sourceIndex = sourceKey ? `${sourceKey}, history_recorded_at` : 'history_recorded_at';
  return `CREATE TABLE ${t.name}_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  ${names.map((name) => `${t.name}.${name}`).join(',\n  ')}
FROM ${t.name} WHERE 0;
CREATE UNIQUE INDEX pk_${t.name}_history ON ${t.name}_history(history_id);
CREATE INDEX idx_${t.name}_history_source ON ${t.name}_history(${sourceIndex});`;
}

function createTriggers(t) {
  const names = t.columns.map(([name]) => name);
  const target = ['history_id', 'history_action', 'history_recorded_at', 'history_recorded_by_user_id', ...names].join(', ');
  const oldValues = names.map((name) => `OLD.${name}`).join(', ');
  return `CREATE TRIGGER trg_${t.name}_history_update
BEFORE UPDATE ON ${t.name}
BEGIN
  INSERT INTO ${t.name}_history (${target})
  VALUES (lower(hex(randomblob(16))), 'UPDATE', ${now}, NEW.updated_by_user_id, ${oldValues});
END;

CREATE TRIGGER trg_${t.name}_history_delete
BEFORE DELETE ON ${t.name}
BEGIN
  INSERT INTO ${t.name}_history (${target})
  VALUES (lower(hex(randomblob(16))), 'DELETE', ${now}, OLD.updated_by_user_id, ${oldValues});
END;`;
}

const sql = [
  'PRAGMA foreign_keys = ON;',
  ...tables.map(createBase),
  ...tables.flatMap((t) => t.indexes.map(([name, columns]) => `CREATE INDEX ${name} ON ${t.name}(${columns});`)),
  ...tables.map(createHistory),
  ...tables.map(createTriggers),
  '',
].join('\n\n');

await fs.mkdir(new URL('../migrations/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../migrations/0001_initial.sql', import.meta.url), sql);
console.log(`Generated ${tables.length} base tables, ${tables.length} history tables, and ${tables.length * 2} triggers.`);
