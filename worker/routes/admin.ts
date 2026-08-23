import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import {
  all, ApiError, audit, data, deleteStatement, first, isPlatformAdmin, newId, now,
  parseJson, requirePlatformAdmin, requireWorkspaceRole, stampStatement,
} from '../lib';

export const adminRoutes = new Hono<AppEnv>();

const userInput = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(['invited', 'active', 'disabled']).default('invited'),
  workspaceId: z.string().optional(),
  role: z.enum(['owner', 'coach', 'client']).optional(),
});

adminRoutes.get('/admin/users', async (c) => {
  requirePlatformAdmin(c.get('principal'));
  const users = await all(c.env.DB.prepare(
    `SELECT u.*,
      (SELECT group_concat(role) FROM platform_user_roles pur WHERE pur.user_id = u.id) AS platform_roles,
      (SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = u.id) AS workspace_count
     FROM users u ORDER BY u.display_name`,
  ));
  return data(c, users);
});

adminRoutes.get('/admin/workspaces/:workspaceId', async (c) => {
  requirePlatformAdmin(c.get('principal'));
  const row = await first(c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(c.req.param('workspaceId')));
  if (!row) throw new ApiError(404, 'not_found', 'Workspace not found.');
  return data(c, row);
});

adminRoutes.post('/admin/users', async (c) => {
  const principal = c.get('principal');
  requirePlatformAdmin(principal);
  const body = await parseJson(c, userInput);
  const timestamp = now();
  const userId = newId();
  const email = body.email.trim().toLowerCase();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO users
       (id, email_normalized, email_display, display_name, status, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(userId, email, body.email.trim(), body.displayName.trim(), body.status, timestamp, timestamp, principal.userId),
  ];
  if (['local', 'test'].includes(c.env.APP_ENV)) {
    statements.push(c.env.DB.prepare(
      `INSERT INTO auth_identities
       (id, user_id, provider, provider_subject, email_at_link, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, 'local', ?, ?, ?, ?, ?)`,
    ).bind(newId(), userId, userId, email, timestamp, timestamp, principal.userId));
  }
  if (body.workspaceId && body.role) {
    statements.push(c.env.DB.prepare(
      `INSERT INTO workspace_members
       (workspace_id, user_id, role, status, joined_at, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).bind(body.workspaceId, userId, body.role, timestamp, timestamp, timestamp, principal.userId));
  }
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'user.provisioned', 'user', userId, {
    workspaceId: body.workspaceId, subjectUserId: userId, metadata: { role: body.role },
  });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId)), 201);
});

adminRoutes.patch('/admin/users/:userId', async (c) => {
  const principal = c.get('principal');
  requirePlatformAdmin(principal);
  const body = await parseJson(c, z.object({
    displayName: z.string().trim().min(1).max(120).optional(),
    status: z.enum(['invited', 'active', 'disabled']).optional(),
  }));
  const current = await first<{ id: string; display_name: string; status: string }>(
    c.env.DB.prepare('SELECT id, display_name, status FROM users WHERE id = ?').bind(c.req.param('userId')),
  );
  if (!current) throw new ApiError(404, 'not_found', 'User not found.');
  await c.env.DB.prepare(
    `UPDATE users SET display_name = ?, status = ?, updated_at = ?, updated_by_user_id = ? WHERE id = ?`,
  ).bind(body.displayName ?? current.display_name, body.status ?? current.status, now(), principal.userId, current.id).run();
  await audit(c.env.DB, principal.userId, 'user.updated', 'user', current.id, { subjectUserId: current.id });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(current.id)));
});

adminRoutes.delete('/admin/users/:userId', async (c) => {
  const principal = c.get('principal');
  requirePlatformAdmin(principal);
  const userId = c.req.param('userId');
  if (userId === principal.userId) throw new ApiError(409, 'self_delete', 'You cannot delete the current administrator.');
  const dependencies = await first<{ memberships: number; roles: number; programs: number }>(c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM workspace_members WHERE user_id = ?) AS memberships,
      (SELECT COUNT(*) FROM platform_user_roles WHERE user_id = ?) AS roles,
      (SELECT COUNT(*) FROM programs WHERE owner_user_id = ?) AS programs`,
  ).bind(userId, userId, userId));
  if (!dependencies) throw new ApiError(404, 'not_found', 'User not found.');
  if (dependencies.memberships || dependencies.roles || dependencies.programs) {
    throw new ApiError(409, 'user_has_dependencies', 'Remove workspace memberships, roles, and program ownership before deleting this user.');
  }
  const identities = await all<{ id: string }>(c.env.DB.prepare('SELECT id FROM auth_identities WHERE user_id = ?').bind(userId));
  const statements: D1PreparedStatement[] = [];
  for (const identity of identities) {
    statements.push(stampStatement(c.env.DB, 'auth_identities', 'id = ?', [identity.id], principal.userId));
  }
  statements.push(stampStatement(c.env.DB, 'users', 'id = ?', [userId], principal.userId));
  statements.push(deleteStatement(c.env.DB, 'users', 'id = ?', [userId]));
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'user.deleted', 'user', userId, { subjectUserId: userId });
  return data(c, { deleted: true });
});

adminRoutes.get('/workspaces/:workspaceId/members', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const rows = await all(c.env.DB.prepare(
    `SELECT wm.*, u.display_name, u.email_display, u.status AS user_status
     FROM workspace_members wm JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? ORDER BY wm.role, u.display_name`,
  ).bind(workspaceId));
  return data(c, rows);
});

adminRoutes.post('/workspaces/:workspaceId/members', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner']);
  const body = await parseJson(c, z.object({ userId: z.string(), role: z.enum(['owner', 'coach', 'client']) }));
  const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO workspace_members
     (workspace_id, user_id, role, status, joined_at, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
  ).bind(workspaceId, body.userId, body.role, timestamp, timestamp, timestamp, principal.userId).run();
  await audit(c.env.DB, principal.userId, 'workspace.member.added', 'workspace_member', body.userId, {
    workspaceId, subjectUserId: body.userId, metadata: { role: body.role },
  });
  return data(c, { workspaceId, userId: body.userId, role: body.role }, 201);
});

adminRoutes.patch('/workspaces/:workspaceId/members/:userId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner']);
  const body = await parseJson(c, z.object({
    role: z.enum(['owner', 'coach', 'client']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }));
  const current = await first<{ role: string; status: string }>(c.env.DB.prepare(
    'SELECT role, status FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(workspaceId, c.req.param('userId')));
  if (!current) throw new ApiError(404, 'not_found', 'Workspace member not found.');
  await c.env.DB.prepare(
    `UPDATE workspace_members SET role = ?, status = ?, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND user_id = ?`,
  ).bind(body.role ?? current.role, body.status ?? current.status, now(), principal.userId, workspaceId, c.req.param('userId')).run();
  return data(c, { workspaceId, userId: c.req.param('userId'), role: body.role ?? current.role, status: body.status ?? current.status });
});

function stampProgramStructures(db: D1Database, workspaceId: string, programIds: string[], actor: string) {
  if (!programIds.length) return [];
  const placeholders = programIds.map(() => '?').join(', ');
  const tables = ['strength_sets', 'cardio_sets', 'workout_exercises', 'workouts', 'mesocycles', 'program_members', 'program_assignments', 'programs'];
  return tables.map((table) => {
    const where = table === 'programs'
      ? `workspace_id = ? AND id IN (${placeholders})`
      : table === 'program_assignments'
        ? `workspace_id = ? AND (assigned_program_id IN (${placeholders}) OR source_program_id IN (${placeholders}))`
        : `workspace_id = ? AND program_id IN (${placeholders})`;
    const params = table === 'program_assignments'
      ? [workspaceId, ...programIds, ...programIds]
      : [workspaceId, ...programIds];
    return stampStatement(db, table, where, params, actor);
  });
}

adminRoutes.delete('/workspaces/:workspaceId/members/:userId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const userId = c.req.param('userId');
  requireWorkspaceRole(principal, workspaceId, ['owner']);
  const current = await first<{ role: string }>(c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  ).bind(workspaceId, userId));
  if (!current) throw new ApiError(404, 'not_found', 'Workspace member not found.');
  if (current.role === 'owner') throw new ApiError(409, 'owner_removal', 'Transfer ownership before removing an owner.');

  if (current.role !== 'client') {
    const dependencies = await first<{ program_count: number }>(c.env.DB.prepare(
      'SELECT COUNT(*) AS program_count FROM programs WHERE workspace_id = ? AND owner_user_id = ?',
    ).bind(workspaceId, userId));
    if (dependencies?.program_count) {
      throw new ApiError(409, 'member_has_programs', 'Transfer or remove this member\'s programs before removing their membership.');
    }
  }

  const programs = current.role === 'client' ? await all<{ id: string }>(c.env.DB.prepare(
    `SELECT DISTINCT p.id FROM programs p
     LEFT JOIN program_assignments pa ON pa.assigned_program_id = p.id
     WHERE p.workspace_id = ? AND (p.owner_user_id = ? OR pa.client_user_id = ?)`,
  ).bind(workspaceId, userId, userId)) : [];
  const programIds = programs.map((program) => program.id);
  const placeholders = programIds.map(() => '?').join(', ');
  const sessionScope = programIds.length
    ? `(athlete_user_id = ? OR program_id IN (${placeholders}))`
    : 'athlete_user_id = ?';
  const sessionParams = [workspaceId, userId, ...programIds];
  const statements: D1PreparedStatement[] = [
    stampStatement(c.env.DB, 'strength_set_results', `workspace_id = ? AND workout_session_id IN (SELECT id FROM workout_sessions WHERE workspace_id = ? AND ${sessionScope})`, [workspaceId, ...sessionParams], principal.userId),
    stampStatement(c.env.DB, 'cardio_set_results', `workspace_id = ? AND workout_session_id IN (SELECT id FROM workout_sessions WHERE workspace_id = ? AND ${sessionScope})`, [workspaceId, ...sessionParams], principal.userId),
    stampStatement(c.env.DB, 'workout_sessions', `workspace_id = ? AND ${sessionScope}`, sessionParams, principal.userId),
  ];
  statements.push(...stampProgramStructures(c.env.DB, workspaceId, programIds, principal.userId));
  statements.push(
    stampStatement(c.env.DB, 'coach_client_relationships', 'workspace_id = ? AND (coach_user_id = ? OR client_user_id = ?)', [workspaceId, userId, userId], principal.userId),
    stampStatement(c.env.DB, 'program_members', programIds.length ? `workspace_id = ? AND user_id = ? AND program_id NOT IN (${placeholders})` : 'workspace_id = ? AND user_id = ?', [workspaceId, userId, ...programIds], principal.userId),
    stampStatement(c.env.DB, 'workspace_members', 'workspace_id = ? AND user_id = ?', [workspaceId, userId], principal.userId),
    deleteStatement(c.env.DB, 'strength_set_results', `workspace_id = ? AND workout_session_id IN (SELECT id FROM workout_sessions WHERE workspace_id = ? AND ${sessionScope})`, [workspaceId, ...sessionParams]),
    deleteStatement(c.env.DB, 'cardio_set_results', `workspace_id = ? AND workout_session_id IN (SELECT id FROM workout_sessions WHERE workspace_id = ? AND ${sessionScope})`, [workspaceId, ...sessionParams]),
    deleteStatement(c.env.DB, 'workout_sessions', `workspace_id = ? AND ${sessionScope}`, sessionParams),
  );
  for (const programId of programIds) statements.push(deleteStatement(c.env.DB, 'programs', 'workspace_id = ? AND id = ?', [workspaceId, programId]));
  statements.push(
    deleteStatement(c.env.DB, 'coach_client_relationships', 'workspace_id = ? AND (coach_user_id = ? OR client_user_id = ?)', [workspaceId, userId, userId]),
    deleteStatement(c.env.DB, 'program_members', 'workspace_id = ? AND user_id = ?', [workspaceId, userId]),
    deleteStatement(c.env.DB, 'workspace_members', 'workspace_id = ? AND user_id = ?', [workspaceId, userId]),
  );
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'workspace.member.removed', 'workspace_member', userId, {
    workspaceId, subjectUserId: userId,
  });
  return data(c, { removed: true });
});

adminRoutes.patch('/admin/workspaces/:workspaceId/legal-hold', async (c) => {
  const principal = c.get('principal');
  requirePlatformAdmin(principal);
  const workspaceId = c.req.param('workspaceId');
  const body = await parseJson(c, z.object({ enabled: z.boolean(), reason: z.string().trim().min(1).max(500).optional() }));
  if (body.enabled && !body.reason) throw new ApiError(400, 'validation_error', 'A reason is required to enable a legal hold.');
  await c.env.DB.prepare(
    `UPDATE workspaces SET legal_hold_at = ?, legal_hold_reason = ?, legal_hold_by_user_id = ?,
       updated_at = ?, updated_by_user_id = ? WHERE id = ?`,
  ).bind(body.enabled ? now() : null, body.enabled ? body.reason : null, body.enabled ? principal.userId : null, now(), principal.userId, workspaceId).run();
  await audit(c.env.DB, principal.userId, body.enabled ? 'workspace.legal_hold.enabled' : 'workspace.legal_hold.disabled', 'workspace', workspaceId, { workspaceId });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId)));
});
