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
  (id, workspace_id, owner_user_id, name, notes, visibility, revision, updated_by_user_id)
VALUES
  ('program-local', 'workspace-local', 'user-coach', 'Local Starter Program', 'A starter program for local development.', 'current', 1, 'user-admin');

-- Synthetic local training data. Idempotent inserts preserve changes made during testing.
INSERT OR IGNORE INTO programs (id, workspace_id, owner_user_id, name, notes, updated_by_user_id)
VALUES ('program-foundation', 'workspace-local', 'user-admin', 'Strength foundation', 'Synthetic local demo: a simple strength and conditioning block.', 'user-admin'),
       ('program-balance', 'workspace-local', 'user-client', 'Build & balance', 'Synthetic local demo assigned to the client account.', 'user-admin');
INSERT OR IGNORE INTO mesocycles (id, workspace_id, program_id, name, mesocycle_length, start_date, sort_order, updated_by_user_id)
VALUES ('cycle-foundation', 'workspace-local', 'program-foundation', 'Build a base', 28, '2026-09-28', 0, 'user-admin'),
       ('cycle-balance', 'workspace-local', 'program-balance', 'Steady progress', 28, '2026-09-28', 0, 'user-admin'),
       ('cycle-coach', 'workspace-local', 'program-local', 'First training block', 7, '2026-09-28', 0, 'user-admin');
INSERT OR IGNORE INTO workouts (id, workspace_id, program_id, mesocycle_id, name, day_offset, sort_order, updated_by_user_id)
VALUES ('workout-lower', 'workspace-local', 'program-foundation', 'cycle-foundation', 'Lower body · Squat focus', 0, 0, 'user-admin'),
       ('workout-upper', 'workspace-local', 'program-foundation', 'cycle-foundation', 'Upper body · Press focus', 2, 1, 'user-admin'),
       ('workout-conditioning', 'workspace-local', 'program-foundation', 'cycle-foundation', 'Easy conditioning', 4, 2, 'user-admin'),
       ('workout-balance', 'workspace-local', 'program-balance', 'cycle-balance', 'Full body strength', 0, 0, 'user-admin'),
       ('workout-coach', 'workspace-local', 'program-local', 'cycle-coach', 'Strength session', 0, 0, 'user-admin');
INSERT OR IGNORE INTO exercises (id, workspace_id, exercise_group_id, name, exercise_type, notes, updated_by_user_id)
VALUES ('exercise-rdl', 'workspace-local', 'group-strength', 'Romanian Deadlift', 'strength', 'Keep a soft bend in your knees. Move through your hips.', 'user-admin'),
       ('exercise-lunge', 'workspace-local', 'group-strength', 'Reverse Lunge', 'strength', 'Control the step back and keep your front foot planted.', 'user-admin'),
       ('exercise-row', 'workspace-local', 'group-strength', 'Dumbbell Row', 'strength', 'Pull your elbow toward your hip.', 'user-admin'),
       ('exercise-bike', 'workspace-local', 'group-cardio', 'Stationary Bike', 'cardio', 'A steady conversational effort.', 'user-admin');
INSERT OR IGNORE INTO workout_exercises (id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, updated_by_user_id)
VALUES ('block-lower-squat', 'workspace-local', 'program-foundation', 'workout-lower', 'exercise-squat', 'variation-squat-standard', 0, 'user-admin'),
       ('block-lower-rdl', 'workspace-local', 'program-foundation', 'workout-lower', 'exercise-rdl', NULL, 1, 'user-admin'),
       ('block-lower-lunge', 'workspace-local', 'program-foundation', 'workout-lower', 'exercise-lunge', NULL, 2, 'user-admin'),
       ('block-upper-bench', 'workspace-local', 'program-foundation', 'workout-upper', 'exercise-bench', 'variation-bench-standard', 0, 'user-admin'),
       ('block-upper-row', 'workspace-local', 'program-foundation', 'workout-upper', 'exercise-row', NULL, 1, 'user-admin'),
       ('block-cardio-run', 'workspace-local', 'program-foundation', 'workout-conditioning', 'exercise-run', 'variation-run-outdoor', 0, 'user-admin'),
       ('block-balance-squat', 'workspace-local', 'program-balance', 'workout-balance', 'exercise-squat', 'variation-squat-standard', 0, 'user-admin'),
       ('block-balance-bench', 'workspace-local', 'program-balance', 'workout-balance', 'exercise-bench', 'variation-bench-standard', 1, 'user-admin');
INSERT OR IGNORE INTO strength_sets (id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, planned_weight, target_rir, coach_notes, updated_by_user_id)
VALUES ('set-squat-1', 'workspace-local', 'program-foundation', 'block-lower-squat', 1, 'warmup', 8, 45, 4, 'Take your time. Find your depth.', 'user-admin'),
       ('set-squat-2', 'workspace-local', 'program-foundation', 'block-lower-squat', 2, 'normal', 8, 95, 2, 'Brace before each rep.', 'user-admin'),
       ('set-squat-3', 'workspace-local', 'program-foundation', 'block-lower-squat', 3, 'normal', 8, 95, 2, NULL, 'user-admin'),
       ('set-rdl-1', 'workspace-local', 'program-foundation', 'block-lower-rdl', 1, 'normal', 10, 65, 2, NULL, 'user-admin'),
       ('set-rdl-2', 'workspace-local', 'program-foundation', 'block-lower-rdl', 2, 'normal', 10, 65, 2, NULL, 'user-admin'),
       ('set-lunge-1', 'workspace-local', 'program-foundation', 'block-lower-lunge', 1, 'normal', 10, 20, 2, 'Reps per leg.', 'user-admin'),
       ('set-bench-1', 'workspace-local', 'program-foundation', 'block-upper-bench', 1, 'normal', 8, 65, 2, NULL, 'user-admin'),
       ('set-row-1', 'workspace-local', 'program-foundation', 'block-upper-row', 1, 'normal', 12, 25, 2, NULL, 'user-admin'),
       ('set-balance-squat', 'workspace-local', 'program-balance', 'block-balance-squat', 1, 'normal', 8, 65, 2, 'Smooth reps, consistent depth.', 'user-admin'),
       ('set-balance-bench', 'workspace-local', 'program-balance', 'block-balance-bench', 1, 'normal', 8, 45, 2, NULL, 'user-admin');
INSERT OR IGNORE INTO cardio_sets (id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, planned_distance, distance_unit, target_rpe, coach_notes, updated_by_user_id)
VALUES ('set-cardio-run', 'workspace-local', 'program-foundation', 'block-cardio-run', 1, 1200, 2, 'mi', 4, 'Keep it conversational.', 'user-admin');
