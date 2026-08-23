PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  email_display TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(email_normalized)
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email_at_link TEXT NOT NULL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(provider, provider_subject),
  UNIQUE(user_id, provider),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE platform_user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  PRIMARY KEY(user_id, role),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  history_retention_days INTEGER NOT NULL DEFAULT 365 CHECK(history_retention_days > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','coach','client')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  PRIMARY KEY(workspace_id, user_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE coach_client_relationships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  coach_user_id TEXT NOT NULL,
  client_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, coach_user_id, client_user_id),
  CHECK(coach_user_id <> client_user_id),
  FOREIGN KEY(workspace_id, coach_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id, client_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);

CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  visibility TEXT NOT NULL DEFAULT 'current' CHECK(visibility IN ('current','archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id, owner_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE mesocycles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mesocycle_length INTEGER NOT NULL DEFAULT 7 CHECK(mesocycle_length > 0),
  start_date TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, program_id, id),
  FOREIGN KEY(workspace_id, program_id) REFERENCES programs(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  mesocycle_id TEXT NOT NULL,
  name TEXT NOT NULL,
  day_offset INTEGER NOT NULL CHECK(day_offset >= 0),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, program_id, id),
  FOREIGN KEY(workspace_id, program_id, mesocycle_id) REFERENCES mesocycles(workspace_id, program_id, id) ON DELETE CASCADE
);

CREATE TABLE exercise_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, id),
  UNIQUE(workspace_id, name),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  exercise_group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'strength' CHECK(exercise_type IN ('strength','cardio')),
  tutorial_url TEXT,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, id),
  FOREIGN KEY(workspace_id, exercise_group_id) REFERENCES exercise_groups(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE exercise_variations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
  tutorial_url TEXT,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, exercise_id, id),
  FOREIGN KEY(workspace_id, exercise_id) REFERENCES exercises(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_variation_id TEXT,
  exercise_order INTEGER NOT NULL CHECK(exercise_order >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, program_id, id),
  UNIQUE(workspace_id, program_id, workout_id, exercise_order),
  FOREIGN KEY(workspace_id, program_id, workout_id) REFERENCES workouts(workspace_id, program_id, id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id, exercise_id) REFERENCES exercises(workspace_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(workspace_id, exercise_id, exercise_variation_id) REFERENCES exercise_variations(workspace_id, exercise_id, id) ON DELETE RESTRICT
);

CREATE TABLE strength_sets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  workout_exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK(set_number >= 1),
  set_type TEXT NOT NULL DEFAULT 'normal' CHECK(set_type IN ('warmup','normal','dropset','failure','rest-pause')),
  planned_reps INTEGER CHECK(planned_reps >= 0),
  actual_reps INTEGER CHECK(actual_reps >= 0),
  planned_weight REAL CHECK(planned_weight >= 0),
  actual_weight REAL CHECK(actual_weight >= 0),
  target_rir INTEGER CHECK(target_rir >= 0),
  actual_rir INTEGER CHECK(actual_rir >= 0),
  coach_notes TEXT,
  athlete_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, program_id, id),
  UNIQUE(workspace_id, program_id, workout_exercise_id, set_number),
  FOREIGN KEY(workspace_id, program_id, workout_exercise_id) REFERENCES workout_exercises(workspace_id, program_id, id) ON DELETE CASCADE
);

CREATE TABLE cardio_sets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  workout_exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK(set_number >= 1),
  planned_duration_seconds INTEGER CHECK(planned_duration_seconds >= 0),
  actual_duration_seconds INTEGER CHECK(actual_duration_seconds >= 0),
  planned_distance REAL CHECK(planned_distance >= 0),
  actual_distance REAL CHECK(actual_distance >= 0),
  distance_unit TEXT CHECK(distance_unit IN ('mi','km','m')),
  target_rpe INTEGER CHECK(target_rpe BETWEEN 1 AND 10),
  actual_rpe INTEGER CHECK(actual_rpe BETWEEN 1 AND 10),
  coach_notes TEXT,
  athlete_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT,
  UNIQUE(workspace_id, program_id, id),
  UNIQUE(workspace_id, program_id, workout_exercise_id, set_number),
  CHECK((planned_distance IS NULL AND actual_distance IS NULL) OR distance_unit IS NOT NULL),
  FOREIGN KEY(workspace_id, program_id, workout_exercise_id) REFERENCES workout_exercises(workspace_id, program_id, id) ON DELETE CASCADE
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  program_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  subject_user_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_user_id TEXT
);

CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

CREATE INDEX idx_workspaces_status ON workspaces(status);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id, status);

CREATE INDEX idx_coach_clients_coach ON coach_client_relationships(workspace_id, coach_user_id, status);

CREATE INDEX idx_coach_clients_client ON coach_client_relationships(workspace_id, client_user_id, status);

CREATE INDEX idx_programs_workspace_owner ON programs(workspace_id, owner_user_id, visibility);

CREATE INDEX idx_mesocycles_program_order ON mesocycles(workspace_id, program_id, sort_order, start_date);

CREATE INDEX idx_workouts_mesocycle_order ON workouts(workspace_id, program_id, mesocycle_id, sort_order);

CREATE INDEX idx_exercise_groups_workspace_name ON exercise_groups(workspace_id, name);

CREATE INDEX idx_exercises_group_name ON exercises(workspace_id, exercise_group_id, name);

CREATE INDEX idx_exercises_type ON exercises(workspace_id, exercise_type);

CREATE INDEX idx_variations_exercise ON exercise_variations(workspace_id, exercise_id, is_primary);

CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workspace_id, program_id, workout_id, exercise_order);

CREATE INDEX idx_workout_exercises_exercise ON workout_exercises(workspace_id, exercise_id);

CREATE INDEX idx_strength_sets_block ON strength_sets(workspace_id, program_id, workout_exercise_id, set_number);

CREATE INDEX idx_cardio_sets_block ON cardio_sets(workspace_id, program_id, workout_exercise_id, set_number);

CREATE INDEX idx_audit_workspace_time ON audit_events(workspace_id, created_at);

CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id, created_at);

CREATE INDEX idx_audit_actor ON audit_events(actor_user_id, created_at);

CREATE TABLE users_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  users.id,
  users.email_normalized,
  users.email_display,
  users.display_name,
  users.status,
  users.created_at,
  users.updated_at,
  users.updated_by_user_id
FROM users WHERE 0;
CREATE UNIQUE INDEX pk_users_history ON users_history(history_id);
CREATE INDEX idx_users_history_source ON users_history(id, history_recorded_at);

CREATE TABLE auth_identities_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  auth_identities.id,
  auth_identities.user_id,
  auth_identities.provider,
  auth_identities.provider_subject,
  auth_identities.email_at_link,
  auth_identities.last_seen_at,
  auth_identities.created_at,
  auth_identities.updated_at,
  auth_identities.updated_by_user_id
FROM auth_identities WHERE 0;
CREATE UNIQUE INDEX pk_auth_identities_history ON auth_identities_history(history_id);
CREATE INDEX idx_auth_identities_history_source ON auth_identities_history(id, history_recorded_at);

CREATE TABLE platform_user_roles_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  platform_user_roles.user_id,
  platform_user_roles.role,
  platform_user_roles.created_at,
  platform_user_roles.updated_at,
  platform_user_roles.updated_by_user_id
FROM platform_user_roles WHERE 0;
CREATE UNIQUE INDEX pk_platform_user_roles_history ON platform_user_roles_history(history_id);
CREATE INDEX idx_platform_user_roles_history_source ON platform_user_roles_history(user_id, role, history_recorded_at);

CREATE TABLE workspaces_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  workspaces.id,
  workspaces.name,
  workspaces.status,
  workspaces.history_retention_days,
  workspaces.created_at,
  workspaces.updated_at,
  workspaces.updated_by_user_id
FROM workspaces WHERE 0;
CREATE UNIQUE INDEX pk_workspaces_history ON workspaces_history(history_id);
CREATE INDEX idx_workspaces_history_source ON workspaces_history(id, history_recorded_at);

CREATE TABLE workspace_members_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  workspace_members.workspace_id,
  workspace_members.user_id,
  workspace_members.role,
  workspace_members.status,
  workspace_members.joined_at,
  workspace_members.created_at,
  workspace_members.updated_at,
  workspace_members.updated_by_user_id
FROM workspace_members WHERE 0;
CREATE UNIQUE INDEX pk_workspace_members_history ON workspace_members_history(history_id);
CREATE INDEX idx_workspace_members_history_source ON workspace_members_history(workspace_id, user_id, history_recorded_at);

CREATE TABLE coach_client_relationships_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  coach_client_relationships.id,
  coach_client_relationships.workspace_id,
  coach_client_relationships.coach_user_id,
  coach_client_relationships.client_user_id,
  coach_client_relationships.status,
  coach_client_relationships.created_at,
  coach_client_relationships.updated_at,
  coach_client_relationships.updated_by_user_id
FROM coach_client_relationships WHERE 0;
CREATE UNIQUE INDEX pk_coach_client_relationships_history ON coach_client_relationships_history(history_id);
CREATE INDEX idx_coach_client_relationships_history_source ON coach_client_relationships_history(id, history_recorded_at);

CREATE TABLE programs_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  programs.id,
  programs.workspace_id,
  programs.owner_user_id,
  programs.name,
  programs.notes,
  programs.visibility,
  programs.revision,
  programs.created_at,
  programs.updated_at,
  programs.updated_by_user_id
FROM programs WHERE 0;
CREATE UNIQUE INDEX pk_programs_history ON programs_history(history_id);
CREATE INDEX idx_programs_history_source ON programs_history(id, history_recorded_at);

CREATE TABLE mesocycles_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  mesocycles.id,
  mesocycles.workspace_id,
  mesocycles.program_id,
  mesocycles.name,
  mesocycles.mesocycle_length,
  mesocycles.start_date,
  mesocycles.notes,
  mesocycles.sort_order,
  mesocycles.version,
  mesocycles.created_at,
  mesocycles.updated_at,
  mesocycles.updated_by_user_id
FROM mesocycles WHERE 0;
CREATE UNIQUE INDEX pk_mesocycles_history ON mesocycles_history(history_id);
CREATE INDEX idx_mesocycles_history_source ON mesocycles_history(id, history_recorded_at);

CREATE TABLE workouts_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  workouts.id,
  workouts.workspace_id,
  workouts.program_id,
  workouts.mesocycle_id,
  workouts.name,
  workouts.day_offset,
  workouts.notes,
  workouts.sort_order,
  workouts.version,
  workouts.created_at,
  workouts.updated_at,
  workouts.updated_by_user_id
FROM workouts WHERE 0;
CREATE UNIQUE INDEX pk_workouts_history ON workouts_history(history_id);
CREATE INDEX idx_workouts_history_source ON workouts_history(id, history_recorded_at);

CREATE TABLE exercise_groups_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  exercise_groups.id,
  exercise_groups.workspace_id,
  exercise_groups.name,
  exercise_groups.notes,
  exercise_groups.created_at,
  exercise_groups.updated_at,
  exercise_groups.updated_by_user_id
FROM exercise_groups WHERE 0;
CREATE UNIQUE INDEX pk_exercise_groups_history ON exercise_groups_history(history_id);
CREATE INDEX idx_exercise_groups_history_source ON exercise_groups_history(id, history_recorded_at);

CREATE TABLE exercises_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  exercises.id,
  exercises.workspace_id,
  exercises.exercise_group_id,
  exercises.name,
  exercises.exercise_type,
  exercises.tutorial_url,
  exercises.notes,
  exercises.version,
  exercises.created_at,
  exercises.updated_at,
  exercises.updated_by_user_id
FROM exercises WHERE 0;
CREATE UNIQUE INDEX pk_exercises_history ON exercises_history(history_id);
CREATE INDEX idx_exercises_history_source ON exercises_history(id, history_recorded_at);

CREATE TABLE exercise_variations_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  exercise_variations.id,
  exercise_variations.workspace_id,
  exercise_variations.exercise_id,
  exercise_variations.name,
  exercise_variations.is_primary,
  exercise_variations.tutorial_url,
  exercise_variations.notes,
  exercise_variations.version,
  exercise_variations.created_at,
  exercise_variations.updated_at,
  exercise_variations.updated_by_user_id
FROM exercise_variations WHERE 0;
CREATE UNIQUE INDEX pk_exercise_variations_history ON exercise_variations_history(history_id);
CREATE INDEX idx_exercise_variations_history_source ON exercise_variations_history(id, history_recorded_at);

CREATE TABLE workout_exercises_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  workout_exercises.id,
  workout_exercises.workspace_id,
  workout_exercises.program_id,
  workout_exercises.workout_id,
  workout_exercises.exercise_id,
  workout_exercises.exercise_variation_id,
  workout_exercises.exercise_order,
  workout_exercises.version,
  workout_exercises.created_at,
  workout_exercises.updated_at,
  workout_exercises.updated_by_user_id
FROM workout_exercises WHERE 0;
CREATE UNIQUE INDEX pk_workout_exercises_history ON workout_exercises_history(history_id);
CREATE INDEX idx_workout_exercises_history_source ON workout_exercises_history(id, history_recorded_at);

CREATE TABLE strength_sets_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  strength_sets.id,
  strength_sets.workspace_id,
  strength_sets.program_id,
  strength_sets.workout_exercise_id,
  strength_sets.set_number,
  strength_sets.set_type,
  strength_sets.planned_reps,
  strength_sets.actual_reps,
  strength_sets.planned_weight,
  strength_sets.actual_weight,
  strength_sets.target_rir,
  strength_sets.actual_rir,
  strength_sets.coach_notes,
  strength_sets.athlete_notes,
  strength_sets.version,
  strength_sets.created_at,
  strength_sets.updated_at,
  strength_sets.updated_by_user_id
FROM strength_sets WHERE 0;
CREATE UNIQUE INDEX pk_strength_sets_history ON strength_sets_history(history_id);
CREATE INDEX idx_strength_sets_history_source ON strength_sets_history(id, history_recorded_at);

CREATE TABLE cardio_sets_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  cardio_sets.id,
  cardio_sets.workspace_id,
  cardio_sets.program_id,
  cardio_sets.workout_exercise_id,
  cardio_sets.set_number,
  cardio_sets.planned_duration_seconds,
  cardio_sets.actual_duration_seconds,
  cardio_sets.planned_distance,
  cardio_sets.actual_distance,
  cardio_sets.distance_unit,
  cardio_sets.target_rpe,
  cardio_sets.actual_rpe,
  cardio_sets.coach_notes,
  cardio_sets.athlete_notes,
  cardio_sets.version,
  cardio_sets.created_at,
  cardio_sets.updated_at,
  cardio_sets.updated_by_user_id
FROM cardio_sets WHERE 0;
CREATE UNIQUE INDEX pk_cardio_sets_history ON cardio_sets_history(history_id);
CREATE INDEX idx_cardio_sets_history_source ON cardio_sets_history(id, history_recorded_at);

CREATE TABLE audit_events_history AS
SELECT
  CAST(NULL AS TEXT) AS history_id,
  CAST(NULL AS TEXT) AS history_action,
  CAST(NULL AS TEXT) AS history_recorded_at,
  CAST(NULL AS TEXT) AS history_recorded_by_user_id,
  audit_events.id,
  audit_events.workspace_id,
  audit_events.program_id,
  audit_events.actor_user_id,
  audit_events.action,
  audit_events.resource_type,
  audit_events.resource_id,
  audit_events.subject_user_id,
  audit_events.metadata_json,
  audit_events.created_at,
  audit_events.updated_at,
  audit_events.updated_by_user_id
FROM audit_events WHERE 0;
CREATE UNIQUE INDEX pk_audit_events_history ON audit_events_history(history_id);
CREATE INDEX idx_audit_events_history_source ON audit_events_history(id, history_recorded_at);

CREATE TRIGGER trg_users_history_update
BEFORE UPDATE ON users
BEGIN
  INSERT INTO users_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, email_normalized, email_display, display_name, status, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.email_normalized, OLD.email_display, OLD.display_name, OLD.status, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_users_history_delete
BEFORE DELETE ON users
BEGIN
  INSERT INTO users_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, email_normalized, email_display, display_name, status, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.email_normalized, OLD.email_display, OLD.display_name, OLD.status, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_auth_identities_history_update
BEFORE UPDATE ON auth_identities
BEGIN
  INSERT INTO auth_identities_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, user_id, provider, provider_subject, email_at_link, last_seen_at, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.user_id, OLD.provider, OLD.provider_subject, OLD.email_at_link, OLD.last_seen_at, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_auth_identities_history_delete
BEFORE DELETE ON auth_identities
BEGIN
  INSERT INTO auth_identities_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, user_id, provider, provider_subject, email_at_link, last_seen_at, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.user_id, OLD.provider, OLD.provider_subject, OLD.email_at_link, OLD.last_seen_at, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_platform_user_roles_history_update
BEFORE UPDATE ON platform_user_roles
BEGIN
  INSERT INTO platform_user_roles_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, user_id, role, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.user_id, OLD.role, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_platform_user_roles_history_delete
BEFORE DELETE ON platform_user_roles
BEGIN
  INSERT INTO platform_user_roles_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, user_id, role, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.user_id, OLD.role, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workspaces_history_update
BEFORE UPDATE ON workspaces
BEGIN
  INSERT INTO workspaces_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, name, status, history_retention_days, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.name, OLD.status, OLD.history_retention_days, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workspaces_history_delete
BEFORE DELETE ON workspaces
BEGIN
  INSERT INTO workspaces_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, name, status, history_retention_days, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.name, OLD.status, OLD.history_retention_days, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workspace_members_history_update
BEFORE UPDATE ON workspace_members
BEGIN
  INSERT INTO workspace_members_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, workspace_id, user_id, role, status, joined_at, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.workspace_id, OLD.user_id, OLD.role, OLD.status, OLD.joined_at, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workspace_members_history_delete
BEFORE DELETE ON workspace_members
BEGIN
  INSERT INTO workspace_members_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, workspace_id, user_id, role, status, joined_at, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.workspace_id, OLD.user_id, OLD.role, OLD.status, OLD.joined_at, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_coach_client_relationships_history_update
BEFORE UPDATE ON coach_client_relationships
BEGIN
  INSERT INTO coach_client_relationships_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, coach_user_id, client_user_id, status, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.coach_user_id, OLD.client_user_id, OLD.status, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_coach_client_relationships_history_delete
BEFORE DELETE ON coach_client_relationships
BEGIN
  INSERT INTO coach_client_relationships_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, coach_user_id, client_user_id, status, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.coach_user_id, OLD.client_user_id, OLD.status, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_programs_history_update
BEFORE UPDATE ON programs
BEGIN
  INSERT INTO programs_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, owner_user_id, name, notes, visibility, revision, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.owner_user_id, OLD.name, OLD.notes, OLD.visibility, OLD.revision, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_programs_history_delete
BEFORE DELETE ON programs
BEGIN
  INSERT INTO programs_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, owner_user_id, name, notes, visibility, revision, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.owner_user_id, OLD.name, OLD.notes, OLD.visibility, OLD.revision, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_mesocycles_history_update
BEFORE UPDATE ON mesocycles
BEGIN
  INSERT INTO mesocycles_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, name, mesocycle_length, start_date, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.name, OLD.mesocycle_length, OLD.start_date, OLD.notes, OLD.sort_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_mesocycles_history_delete
BEFORE DELETE ON mesocycles
BEGIN
  INSERT INTO mesocycles_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, name, mesocycle_length, start_date, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.name, OLD.mesocycle_length, OLD.start_date, OLD.notes, OLD.sort_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workouts_history_update
BEFORE UPDATE ON workouts
BEGIN
  INSERT INTO workouts_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.mesocycle_id, OLD.name, OLD.day_offset, OLD.notes, OLD.sort_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workouts_history_delete
BEFORE DELETE ON workouts
BEGIN
  INSERT INTO workouts_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.mesocycle_id, OLD.name, OLD.day_offset, OLD.notes, OLD.sort_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercise_groups_history_update
BEFORE UPDATE ON exercise_groups
BEGIN
  INSERT INTO exercise_groups_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, name, notes, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.name, OLD.notes, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercise_groups_history_delete
BEFORE DELETE ON exercise_groups
BEGIN
  INSERT INTO exercise_groups_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, name, notes, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.name, OLD.notes, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercises_history_update
BEFORE UPDATE ON exercises
BEGIN
  INSERT INTO exercises_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, exercise_group_id, name, exercise_type, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.exercise_group_id, OLD.name, OLD.exercise_type, OLD.tutorial_url, OLD.notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercises_history_delete
BEFORE DELETE ON exercises
BEGIN
  INSERT INTO exercises_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, exercise_group_id, name, exercise_type, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.exercise_group_id, OLD.name, OLD.exercise_type, OLD.tutorial_url, OLD.notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercise_variations_history_update
BEFORE UPDATE ON exercise_variations
BEGIN
  INSERT INTO exercise_variations_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, exercise_id, name, is_primary, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.exercise_id, OLD.name, OLD.is_primary, OLD.tutorial_url, OLD.notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_exercise_variations_history_delete
BEFORE DELETE ON exercise_variations
BEGIN
  INSERT INTO exercise_variations_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, exercise_id, name, is_primary, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.exercise_id, OLD.name, OLD.is_primary, OLD.tutorial_url, OLD.notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workout_exercises_history_update
BEFORE UPDATE ON workout_exercises
BEGIN
  INSERT INTO workout_exercises_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_id, OLD.exercise_id, OLD.exercise_variation_id, OLD.exercise_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_workout_exercises_history_delete
BEFORE DELETE ON workout_exercises
BEGIN
  INSERT INTO workout_exercises_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_id, OLD.exercise_id, OLD.exercise_variation_id, OLD.exercise_order, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_strength_sets_history_update
BEFORE UPDATE ON strength_sets
BEGIN
  INSERT INTO strength_sets_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, actual_reps, planned_weight, actual_weight, target_rir, actual_rir, coach_notes, athlete_notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_exercise_id, OLD.set_number, OLD.set_type, OLD.planned_reps, OLD.actual_reps, OLD.planned_weight, OLD.actual_weight, OLD.target_rir, OLD.actual_rir, OLD.coach_notes, OLD.athlete_notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_strength_sets_history_delete
BEFORE DELETE ON strength_sets
BEGIN
  INSERT INTO strength_sets_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, actual_reps, planned_weight, actual_weight, target_rir, actual_rir, coach_notes, athlete_notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_exercise_id, OLD.set_number, OLD.set_type, OLD.planned_reps, OLD.actual_reps, OLD.planned_weight, OLD.actual_weight, OLD.target_rir, OLD.actual_rir, OLD.coach_notes, OLD.athlete_notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_cardio_sets_history_update
BEFORE UPDATE ON cardio_sets
BEGIN
  INSERT INTO cardio_sets_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, actual_duration_seconds, planned_distance, actual_distance, distance_unit, target_rpe, actual_rpe, coach_notes, athlete_notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_exercise_id, OLD.set_number, OLD.planned_duration_seconds, OLD.actual_duration_seconds, OLD.planned_distance, OLD.actual_distance, OLD.distance_unit, OLD.target_rpe, OLD.actual_rpe, OLD.coach_notes, OLD.athlete_notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_cardio_sets_history_delete
BEFORE DELETE ON cardio_sets
BEGIN
  INSERT INTO cardio_sets_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, actual_duration_seconds, planned_distance, actual_distance, distance_unit, target_rpe, actual_rpe, coach_notes, athlete_notes, version, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.workout_exercise_id, OLD.set_number, OLD.planned_duration_seconds, OLD.actual_duration_seconds, OLD.planned_distance, OLD.actual_distance, OLD.distance_unit, OLD.target_rpe, OLD.actual_rpe, OLD.coach_notes, OLD.athlete_notes, OLD.version, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_audit_events_history_update
BEFORE UPDATE ON audit_events
BEGIN
  INSERT INTO audit_events_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, actor_user_id, action, resource_type, resource_id, subject_user_id, metadata_json, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'UPDATE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NEW.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.actor_user_id, OLD.action, OLD.resource_type, OLD.resource_id, OLD.subject_user_id, OLD.metadata_json, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

CREATE TRIGGER trg_audit_events_history_delete
BEFORE DELETE ON audit_events
BEGIN
  INSERT INTO audit_events_history (history_id, history_action, history_recorded_at, history_recorded_by_user_id, id, workspace_id, program_id, actor_user_id, action, resource_type, resource_id, subject_user_id, metadata_json, created_at, updated_at, updated_by_user_id)
  VALUES (lower(hex(randomblob(16))), 'DELETE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), OLD.updated_by_user_id, OLD.id, OLD.workspace_id, OLD.program_id, OLD.actor_user_id, OLD.action, OLD.resource_type, OLD.resource_id, OLD.subject_user_id, OLD.metadata_json, OLD.created_at, OLD.updated_at, OLD.updated_by_user_id);
END;

