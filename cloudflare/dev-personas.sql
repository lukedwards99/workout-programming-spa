-- Simulated accounts, selectable only after the allowlisted owner's real Access login.
INSERT INTO users (id, email_normalized, email_display, display_name, status, updated_by_user_id)
VALUES ('user-dev-coach', 'coach@liftlog.test', 'coach@liftlog.test', 'Test Coach', 'active', 'user-owner'),
       ('user-dev-athlete', 'athlete@liftlog.test', 'athlete@liftlog.test', 'Test Athlete', 'active', 'user-owner');
INSERT INTO workspace_members (workspace_id, user_id, role, updated_by_user_id)
VALUES ('workspace-owner', 'user-dev-coach', 'coach', 'user-owner'),
       ('workspace-owner', 'user-dev-athlete', 'client', 'user-owner');
INSERT INTO coach_client_relationships (id, workspace_id, coach_user_id, client_user_id, updated_by_user_id)
VALUES ('relationship-dev-test', 'workspace-owner', 'user-dev-coach', 'user-dev-athlete', 'user-owner');
