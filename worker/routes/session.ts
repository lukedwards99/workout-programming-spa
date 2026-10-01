import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, audit, data, newId, now, parseJson } from '../lib';
import { authenticatedPrincipal, canSwitchIdentity, hashSessionToken, isLocalAuth, loadPrincipal, loadTestPrincipal, LOCAL_USER_COOKIE, TEST_USER_COOKIE, requireAuth } from '../auth';

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
  const previousToken = getCookie(c, TEST_USER_COOKIE);
  if (previousToken) await c.env.DB.prepare('DELETE FROM test_identity_sessions WHERE token_hash = ?').bind(await hashSessionToken(previousToken)).run();
  setCookie(c, LOCAL_USER_COOKIE, principal.userId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: false,
    maxAge: 60 * 60 * 12,
  });
  deleteCookie(c, TEST_USER_COOKIE, { path: '/' });
  await c.env.DB.prepare(
    `UPDATE auth_identities SET last_seen_at = ?, updated_at = ?, updated_by_user_id = ?
     WHERE user_id = ? AND provider = 'local'`,
  ).bind(new Date().toISOString(), new Date().toISOString(), principal.userId, principal.userId).run();
  await audit(c.env.DB, principal.userId, 'session.local.started', 'user', principal.userId);
  return data(c, principal);
});

sessionRoutes.delete('/session', async (c) => {
  const token = getCookie(c, TEST_USER_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM test_identity_sessions WHERE token_hash = ?').bind(await hashSessionToken(token)).run();
  deleteCookie(c, TEST_USER_COOKIE, { path: '/' });
  deleteCookie(c, LOCAL_USER_COOKIE, { path: '/' });
  return data(c, { signedOut: true });
});

sessionRoutes.use('/session', requireAuth);
sessionRoutes.get('/session', (c) => data(c, c.get('principal')));

// Always authorize the real actor before applying the temporary identity wrapper.
sessionRoutes.use('/test-auth/*', async (c, next) => {
  if (!isLocalAuth(c.env) && c.env.APP_ENV !== 'dev') throw new ApiError(404, 'not_found', 'Test identity switching is unavailable.');
  const actor = await authenticatedPrincipal(c);
  if (!canSwitchIdentity(c.env, actor)) throw new ApiError(404, 'not_found', 'Test identity switching is unavailable.');
  c.set('principal', actor);
  await next();
});
sessionRoutes.get('/test-auth/users', async (c) => data(c, await all(c.env.DB.prepare(
  `SELECT u.id, u.display_name, u.email_display, u.status,
    (SELECT group_concat(DISTINCT role) FROM workspace_members wm WHERE wm.user_id = u.id AND wm.status = 'active') AS roles
   FROM users u WHERE u.status IN ('active', 'invited') ORDER BY u.display_name`,
))));
sessionRoutes.post('/test-auth/session', async (c) => {
  const actor = c.get('principal');
  const { userId } = await parseJson(c, z.object({ userId: z.string().min(1).max(120) }));
  const subject = await loadTestPrincipal(c.env.DB, userId);
  if (!subject) throw new ApiError(400, 'invalid_test_user', 'Choose an active or invited test account.');
  const previousToken = getCookie(c, TEST_USER_COOKIE);
  if (previousToken) await c.env.DB.prepare('DELETE FROM test_identity_sessions WHERE token_hash = ?').bind(await hashSessionToken(previousToken)).run();
  await c.env.DB.prepare('DELETE FROM test_identity_sessions WHERE expires_at <= ?').bind(now()).run();
  const token = newId();
  await c.env.DB.prepare('INSERT INTO test_identity_sessions (token_hash, actor_user_id, subject_user_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await hashSessionToken(token), actor.userId, subject.userId, new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()).run();
  await audit(c.env.DB, actor.userId, 'session.test.started', 'user', subject.userId,
    { subjectUserId: subject.userId, metadata: { authenticatedEmail: actor.verifiedEmail } });
  setCookie(c, TEST_USER_COOKIE, token, { httpOnly: true, secure: !isLocalAuth(c.env), sameSite: 'Strict', path: '/', maxAge: 6 * 60 * 60 });
  subject.testing = { canSwitch: true, authenticatedEmail: actor.verifiedEmail, isImpersonating: subject.userId !== actor.userId };
  return data(c, subject);
});
sessionRoutes.delete('/test-auth/session', async (c) => {
  const token = getCookie(c, TEST_USER_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM test_identity_sessions WHERE token_hash = ? AND actor_user_id = ?')
    .bind(await hashSessionToken(token), c.get('principal').userId).run();
  deleteCookie(c, TEST_USER_COOKIE, { path: '/' });
  await audit(c.env.DB, c.get('principal').userId, 'session.test.ended', 'user', c.get('principal').userId);
  return data(c, { restored: true });
});
