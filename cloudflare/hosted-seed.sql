PRAGMA foreign_keys = ON;
INSERT INTO users (id, email_normalized, email_display, display_name, status, updated_by_user_id)
VALUES ('user-owner', 'luke.edwards20@gmail.com', 'luke.edwards20@gmail.com', 'Luke Edwards', 'active', 'user-owner');
INSERT INTO auth_identities (id, user_id, provider, provider_subject, email_at_link, updated_by_user_id)
VALUES ('identity-owner-access', 'user-owner', 'cloudflare-access', 'luke.edwards20@gmail.com', 'luke.edwards20@gmail.com', 'user-owner');
INSERT INTO platform_user_roles (user_id, role, updated_by_user_id) VALUES ('user-owner', 'admin', 'user-owner');
INSERT INTO workspaces (id, name, updated_by_user_id) VALUES ('workspace-owner', 'LiftLog', 'user-owner');
INSERT INTO workspace_members (workspace_id, user_id, role, updated_by_user_id) VALUES ('workspace-owner', 'user-owner', 'owner', 'user-owner');
