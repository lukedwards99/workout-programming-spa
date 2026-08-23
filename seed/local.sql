PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users
  (id, email_normalized, email_display, display_name, status, updated_by_user_id)
VALUES
  ('user-admin', 'admin@liftlog.local', 'admin@liftlog.local', 'Local Admin', 'active', 'user-admin'),
  ('user-coach', 'coach@liftlog.local', 'coach@liftlog.local', 'Local Coach', 'active', 'user-admin'),
  ('user-client', 'client@liftlog.local', 'client@liftlog.local', 'Local Client', 'active', 'user-admin');

INSERT OR IGNORE INTO auth_identities
  (id, user_id, provider, provider_subject, email_at_link, updated_by_user_id)
VALUES
  ('identity-admin-local', 'user-admin', 'local', 'user-admin', 'admin@liftlog.local', 'user-admin'),
  ('identity-coach-local', 'user-coach', 'local', 'user-coach', 'coach@liftlog.local', 'user-admin'),
  ('identity-client-local', 'user-client', 'local', 'user-client', 'client@liftlog.local', 'user-admin');

INSERT OR IGNORE INTO platform_user_roles
  (user_id, role, updated_by_user_id)
VALUES ('user-admin', 'admin', 'user-admin');

INSERT OR IGNORE INTO workspaces
  (id, name, status, history_retention_days, updated_by_user_id)
VALUES ('workspace-local', 'LiftLog Local Beta', 'active', 365, 'user-admin');

INSERT OR IGNORE INTO workspace_members
  (workspace_id, user_id, role, status, updated_by_user_id)
VALUES
  ('workspace-local', 'user-admin', 'owner', 'active', 'user-admin'),
  ('workspace-local', 'user-coach', 'coach', 'active', 'user-admin'),
  ('workspace-local', 'user-client', 'client', 'active', 'user-admin');

INSERT OR IGNORE INTO coach_client_relationships
  (id, workspace_id, coach_user_id, client_user_id, status, updated_by_user_id)
VALUES
  ('relationship-local', 'workspace-local', 'user-coach', 'user-client', 'active', 'user-admin');

INSERT OR IGNORE INTO exercise_groups
  (id, workspace_id, name, notes, updated_by_user_id)
VALUES
  ('group-strength', 'workspace-local', 'Strength', 'Local starter strength exercises.', 'user-admin'),
  ('group-cardio', 'workspace-local', 'Cardio', 'Local starter cardio exercises.', 'user-admin');

INSERT OR IGNORE INTO exercises
  (id, workspace_id, exercise_group_id, name, exercise_type, notes, updated_by_user_id)
VALUES
  ('exercise-squat', 'workspace-local', 'group-strength', 'Barbell Squat', 'strength', 'Starter lower-body strength exercise.', 'user-admin'),
  ('exercise-bench', 'workspace-local', 'group-strength', 'Barbell Bench Press', 'strength', 'Starter upper-body strength exercise.', 'user-admin'),
  ('exercise-run', 'workspace-local', 'group-cardio', 'Running', 'cardio', 'Starter cardio exercise.', 'user-admin');

INSERT OR IGNORE INTO exercise_variations
  (id, workspace_id, exercise_id, name, is_primary, updated_by_user_id)
VALUES
  ('variation-squat-standard', 'workspace-local', 'exercise-squat', 'Standard', 1, 'user-admin'),
  ('variation-bench-standard', 'workspace-local', 'exercise-bench', 'Standard', 1, 'user-admin'),
  ('variation-run-outdoor', 'workspace-local', 'exercise-run', 'Outdoor', 1, 'user-admin');

INSERT OR IGNORE INTO programs
  (id, workspace_id, owner_user_id, name, notes, kind, status, visibility, revision, updated_by_user_id)
VALUES
  ('program-local-template', 'workspace-local', 'user-coach', 'Local Starter Program', 'A template ready to assign during local development.', 'template', 'active', 'current', 1, 'user-admin');

