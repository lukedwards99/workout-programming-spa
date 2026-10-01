import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, audit, data, newId, now, parseJson } from '../lib';
import { loadPrincipal, LOCAL_USER_COOKIE, requireAuth } from '../auth';

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.get('/health', (c) => data(c, { status: 'ok', environment: c.env.APP_ENV }));
sessionRoutes.get('/session/config', (c) => data(c, {
  authMode: ['local', 'test'].includes(c.env.APP_ENV) && c.env.LOCAL_AUTH_ENABLED === 'true' ? 'local' : 'access',
  environment: c.env.APP_ENV,
  disposableData: !['local', 'test'].includes(c.env.APP_ENV),
}));

sessionRoutes.get('/local-auth/users', async (c) => {
  if (c.env.LOCAL_AUTH_ENABLED !== 'true' || !['local', 'test'].includes(c.env.APP_ENV)) {
    throw new ApiError(404, 'not_found', 'Local authentication is not available.');
  }
  const users = await all<{
    id: string;
    display_name: string;
    email_display: string;
    status: string;
  }>(c.env.DB.prepare(
    `SELECT DISTINCT u.id, u.display_name, u.email_display, u.status
     FROM users u JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'local'
     WHERE u.status = 'active' AND u.email_normalized NOT LIKE '%@example.test' ORDER BY u.display_name`,
  ));
  return data(c, users);
});

sessionRoutes.post('/testing/fixtures', async (c) => {
  if (c.env.LOCAL_AUTH_ENABLED !== 'true' || !['local', 'test'].includes(c.env.APP_ENV)) {
    throw new ApiError(404, 'not_found', 'Test fixtures are not available.');
  }
  const body = await parseJson(c, z.object({ label: z.string().trim().min(1).max(80).optional() }));
  const suffix = newId(); const timestamp = now(); const label = body.label || 'Playwright';
  const workspaceId = `workspace-${suffix}`; const ownerId = `owner-${suffix}`; const coachId = `coach-${suffix}`; const clientId = `client-${suffix}`;
  const relationshipId = newId(); const groupId = newId(); const exerciseId = newId(); const variationId = newId(); const programId = newId();
  const users = [
    [ownerId, `${suffix}.owner@example.test`, `${label} Owner`],
    [coachId, `${suffix}.coach@example.test`, `${label} Coach`],
    [clientId, `${suffix}.client@example.test`, `${label} Client`],
  ] as const;
  const statements: D1PreparedStatement[] = [];
  for (const [userId, email, displayName] of users) {
    statements.push(c.env.DB.prepare(`INSERT INTO users
      (id, email_normalized, email_display, display_name, status, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, ?, 'active', ?, ?, NULL)`).bind(userId, email, email, displayName, timestamp, timestamp));
    statements.push(c.env.DB.prepare(`INSERT INTO auth_identities
      (id, user_id, provider, provider_subject, email_at_link, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, 'local', ?, ?, ?, ?, ?)`).bind(newId(), userId, userId, email, timestamp, timestamp, ownerId));
  }
  statements.push(
    c.env.DB.prepare(`INSERT INTO platform_user_roles (user_id, role, created_at, updated_at, updated_by_user_id) VALUES (?, 'admin', ?, ?, ?)`).bind(ownerId, timestamp, timestamp, ownerId),
    c.env.DB.prepare(`INSERT INTO workspaces (id, name, history_retention_days, created_at, updated_at, updated_by_user_id) VALUES (?, ?, 365, ?, ?, ?)`).bind(workspaceId, `${label} Workspace`, timestamp, timestamp, ownerId),
  );
  for (const [userId, role] of [[ownerId, 'owner'], [coachId, 'coach'], [clientId, 'client']] as const) {
    statements.push(c.env.DB.prepare(`INSERT INTO workspace_members
      (workspace_id, user_id, role, status, joined_at, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`).bind(workspaceId, userId, role, timestamp, timestamp, timestamp, ownerId));
  }
  statements.push(
    c.env.DB.prepare(`INSERT INTO coach_client_relationships
      (id, workspace_id, coach_user_id, client_user_id, status, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`).bind(relationshipId, workspaceId, coachId, clientId, timestamp, timestamp, ownerId),
    c.env.DB.prepare(`INSERT INTO exercise_groups (id, workspace_id, name, notes, created_at, updated_at, updated_by_user_id) VALUES (?, ?, 'Strength', NULL, ?, ?, ?)`).bind(groupId, workspaceId, timestamp, timestamp, ownerId),
    c.env.DB.prepare(`INSERT INTO exercises (id, workspace_id, exercise_group_id, name, exercise_type, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, 'Back Squat', 'strength', NULL, NULL, 1, ?, ?, ?)`).bind(exerciseId, workspaceId, groupId, timestamp, timestamp, ownerId),
    c.env.DB.prepare(`INSERT INTO exercise_variations (id, workspace_id, exercise_id, name, is_primary, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, 'Barbell', 1, NULL, NULL, 1, ?, ?, ?)`).bind(variationId, workspaceId, exerciseId, timestamp, timestamp, ownerId),
    c.env.DB.prepare(`INSERT INTO programs (id, workspace_id, owner_user_id, name, notes, visibility, revision, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, 'Beta Program', NULL, 'current', 1, ?, ?, ?)`).bind(programId, workspaceId, coachId, timestamp, timestamp, ownerId),
  );
  await c.env.DB.batch(statements);
  return data(c, { workspaceId, ownerId, coachId, clientId, programId }, 201);
});

sessionRoutes.post('/local-auth/session', async (c) => {
  if (c.env.LOCAL_AUTH_ENABLED !== 'true' || !['local', 'test'].includes(c.env.APP_ENV)) {
    throw new ApiError(404, 'not_found', 'Local authentication is not available.');
  }
  const body = await parseJson(c, z.object({ userId: z.string().min(1) }));
  const principal = await loadPrincipal(c.env.DB, body.userId);
  if (!principal) throw new ApiError(401, 'invalid_local_user', 'That local user cannot sign in.');
  setCookie(c, LOCAL_USER_COOKIE, principal.userId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: false,
    maxAge: 60 * 60 * 12,
  });
  await c.env.DB.prepare(
    `UPDATE auth_identities SET last_seen_at = ?, updated_at = ?, updated_by_user_id = ?
     WHERE user_id = ? AND provider = 'local'`,
  ).bind(new Date().toISOString(), new Date().toISOString(), principal.userId, principal.userId).run();
  await audit(c.env.DB, principal.userId, 'session.local.started', 'user', principal.userId);
  return data(c, principal);
});

sessionRoutes.delete('/session', async (c) => {
  deleteCookie(c, LOCAL_USER_COOKIE, { path: '/' });
  return data(c, { signedOut: true });
});

sessionRoutes.use('/session', requireAuth);
sessionRoutes.get('/session', (c) => data(c, c.get('principal')));
