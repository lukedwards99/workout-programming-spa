-- Temporary authentication wrapper. Opaque cookie tokens are stored only as hashes.
-- These expiring sessions are separate from the workout/history data model.
CREATE TABLE test_identity_sessions (
  token_hash TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_test_identity_expiry ON test_identity_sessions(expires_at);
