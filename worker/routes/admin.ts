import { accessibleSpaces, requireStaff } from '../spaces';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, audit, data, deleteStatement, first, isPlatformAdmin, membership, newId, now, parseJson, requirePlatformAdmin, requireWorkspaceRole, stampStatement } from '../lib';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.get('/workspaces', async (c) => {
  const principal = c.get('principal');
  const spaces = await accessibleSpaces(c.env.DB, principal.userId, isPlatformAdmin(principal));
  return data(c, spaces.map(row => ({ id: row.workspace_id, name: row.workspace_name, kind: row.kind, client_user_id: row.client_user_id, personal_owner_user_id: row.personal_owner_user_id, parent_workspace_id: row.parent_workspace_id, member_role: row.role, member_status: row.status })));
});

adminRoutes.post('/workspaces', async (c) => {
  const principal = c.get('principal');
  requireStaff(principal);
  const body = await parseJson(c, z.object({ name: z.string().trim().min(1).max(160), kind: z.enum(['personal','organization']).default('personal') })); const id = newId(), timestamp = now();
  if (body.kind === 'organization') requirePlatformAdmin(principal);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO workspaces (id,name,status,history_retention_days,kind,personal_owner_user_id,created_at,updated_at,updated_by_user_id) VALUES (?,?,'active',365,?,?,?,?,?)`).bind(id, body.name, body.kind, body.kind === 'personal' ? principal.userId : null, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role,status,joined_at,created_at,updated_at,updated_by_user_id) VALUES (?,?,'owner','active',?,?,?,?)`).bind(id, principal.userId, timestamp, timestamp, timestamp, principal.userId),
  ]);
  await audit(c.env.DB, principal.userId, 'workspace.created', 'workspace', id, { workspaceId: id });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workspaces WHERE id=?').bind(id)), 201);
});

adminRoutes.delete('/workspaces/:workspaceId', async (c) => {
  const principal = c.get('principal'), workspaceId = c.req.param('workspaceId');
  if (!isPlatformAdmin(principal) && membership(principal, workspaceId)?.role !== 'owner') throw new ApiError(403, 'forbidden', 'Only a workspace owner or platform administrator can delete this workspace.');
  const body = await parseJson(c, z.object({ confirmName: z.string() }));
  const workspace = await first<{ name: string; kind: string }>(c.env.DB.prepare('SELECT name,kind FROM workspaces WHERE id=?').bind(workspaceId));
  if (!workspace) throw new ApiError(404, 'not_found', 'Workspace not found.');
  if (workspace.kind === 'client') throw new ApiError(409, 'client_space_required', 'A client’s space stays with the client. Release their assignment instead.');
  if (await first(c.env.DB.prepare('SELECT 1 FROM workspaces WHERE parent_workspace_id=?').bind(workspaceId))) throw new ApiError(409,'organization_has_clients','An organization with client spaces cannot be deleted.');
  if (body.confirmName !== workspace.name) throw new ApiError(400, 'confirmation_mismatch', 'Enter the workspace name exactly to confirm deletion.');
  const actor = principal.userId;
  const statements: D1PreparedStatement[] = [
    stampStatement(c.env.DB, 'strength_sets', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'cardio_sets', 'workspace_id=?', [workspaceId], actor),
    stampStatement(c.env.DB, 'workout_exercises', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'workouts', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'mesocycles', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'programs', 'workspace_id=?', [workspaceId], actor),
    stampStatement(c.env.DB, 'exercise_variations', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'exercises', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'exercise_groups', 'workspace_id=?', [workspaceId], actor),
    stampStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'workspace_members', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'audit_events', 'workspace_id=?', [workspaceId], actor), stampStatement(c.env.DB, 'workspaces', 'id=?', [workspaceId], actor),
    deleteStatement(c.env.DB, 'strength_sets', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'cardio_sets', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'workout_exercises', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'workouts', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'mesocycles', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'programs', 'workspace_id=?', [workspaceId]),
    deleteStatement(c.env.DB, 'exercise_variations', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'exercises', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'exercise_groups', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'workspace_members', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'audit_events', 'workspace_id=?', [workspaceId]), deleteStatement(c.env.DB, 'workspaces', 'id=?', [workspaceId]),
  ];
  await c.env.DB.batch(statements);
  await audit(c.env.DB, actor, 'workspace.deleted', 'workspace', workspaceId, { metadata: { name: workspace.name } });
  return data(c, { deleted: true });
});


async function requireOrganization(db: D1Database, id: string) {
  const row = await first<{ kind: string }>(db.prepare('SELECT kind FROM workspaces WHERE id=?').bind(id));
  if (!row) throw new ApiError(404,'not_found','Space not found.');
  if (row.kind !== 'organization') throw new ApiError(409,'managed_space_members','Client and personal space access is managed through the organization roster and assignments.');
}

async function validateRosterRole(db: D1Database, organizationId: string, userId: string, role: string) {
  const space=await first<{parent_workspace_id:string}>(db.prepare('SELECT parent_workspace_id FROM workspaces WHERE client_user_id=?').bind(userId));
  if (space && (role !== 'client' || space.parent_workspace_id !== organizationId)) throw new ApiError(409,'client_space_required','This client already has one space and an organization roster.');
  if (role === 'client' && !space && await first(db.prepare("SELECT 1 FROM workspace_members WHERE user_id=? AND role IN ('owner','coach')").bind(userId))) throw new ApiError(409,'coach_personal_space','Coaches and owners use personal spaces for their own work.');
}

const userInput = z.object({ email: z.string().email(), displayName: z.string().trim().min(1).max(120), status: z.enum(['invited', 'active', 'disabled']).default('invited'), workspaceId: z.string().optional(), role: z.enum(['owner', 'coach', 'client']).optional() });
adminRoutes.get('/admin/users', async (c) => { requirePlatformAdmin(c.get('principal')); return data(c, await all(c.env.DB.prepare(`SELECT u.*,(SELECT group_concat(role) FROM platform_user_roles r WHERE r.user_id=u.id) AS platform_roles,(SELECT COUNT(*) FROM workspace_members m WHERE m.user_id=u.id) AS workspace_count FROM users u ORDER BY u.display_name`))); });
adminRoutes.post('/admin/users', async (c) => {
  const principal = c.get('principal'); requirePlatformAdmin(principal); const body = await parseJson(c, userInput); if (body.workspaceId && body.role) await requireOrganization(c.env.DB,body.workspaceId); const id = newId(), timestamp = now(), email = body.email.trim().toLowerCase();
  const statements: D1PreparedStatement[] = [c.env.DB.prepare(`INSERT INTO users (id,email_normalized,email_display,display_name,status,created_at,updated_at,updated_by_user_id) VALUES (?,?,?,?,?,?,?,?)`).bind(id, email, body.email.trim(), body.displayName, body.status, timestamp, timestamp, principal.userId)];
  if (['local', 'test'].includes(c.env.APP_ENV)) statements.push(c.env.DB.prepare(`INSERT INTO auth_identities (id,user_id,provider,provider_subject,email_at_link,created_at,updated_at,updated_by_user_id) VALUES (?,?,'local',?,?,?,?,?)`).bind(newId(), id, id, email, timestamp, timestamp, principal.userId));
  if (body.workspaceId && body.role) statements.push(c.env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role,status,joined_at,created_at,updated_at,updated_by_user_id) VALUES (?,?,?,'active',?,?,?,?)`).bind(body.workspaceId, id, body.role, timestamp, timestamp, timestamp, principal.userId));
  await c.env.DB.batch(statements); await audit(c.env.DB, principal.userId, 'user.provisioned', 'user', id, { workspaceId: body.workspaceId, subjectUserId: id, metadata: { role: body.role } }); return data(c, await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id)), 201);
});
adminRoutes.patch('/admin/users/:userId', async (c) => { const p = c.get('principal'); requirePlatformAdmin(p); const id = c.req.param('userId'); const b = await parseJson(c, z.object({ displayName: z.string().trim().min(1).max(120).optional(), status: z.enum(['invited', 'active', 'disabled']).optional() })); const current = await first<{ display_name: string; status: string }>(c.env.DB.prepare('SELECT display_name,status FROM users WHERE id=?').bind(id)); if (!current) throw new ApiError(404, 'not_found', 'User not found.'); await c.env.DB.prepare('UPDATE users SET display_name=?,status=?,updated_at=?,updated_by_user_id=? WHERE id=?').bind(b.displayName ?? current.display_name, b.status ?? current.status, now(), p.userId, id).run(); return data(c, await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id))); });
adminRoutes.delete('/admin/users/:userId', async (c) => { const p = c.get('principal'); requirePlatformAdmin(p); const id = c.req.param('userId'); if (id === p.userId) throw new ApiError(409, 'self_delete', 'You cannot delete the current administrator.'); const deps = await first<{ memberships: number; roles: number; programs: number }>(c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM workspace_members WHERE user_id=?) AS memberships,(SELECT COUNT(*) FROM platform_user_roles WHERE user_id=?) AS roles,(SELECT COUNT(*) FROM programs WHERE owner_user_id=?) AS programs`).bind(id, id, id)); if (!deps) throw new ApiError(404, 'not_found', 'User not found.'); if (deps.memberships || deps.roles || deps.programs) throw new ApiError(409, 'user_has_dependencies', 'Remove workspace memberships, roles, and program ownership first.'); await c.env.DB.batch([stampStatement(c.env.DB, 'auth_identities', 'user_id=?', [id], p.userId), stampStatement(c.env.DB, 'users', 'id=?', [id], p.userId), deleteStatement(c.env.DB, 'users', 'id=?', [id])]); return data(c, { deleted: true }); });

adminRoutes.get('/workspaces/:workspaceId/members', async (c) => { const p = c.get('principal'), id = c.req.param('workspaceId'); requireWorkspaceRole(p, id, ['owner', 'coach']); return data(c, await all(c.env.DB.prepare(`SELECT wm.*,u.display_name,u.email_display,u.status AS user_status FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=? ORDER BY wm.role,u.display_name`).bind(id))); });
adminRoutes.post('/workspaces/:workspaceId/members', async (c) => { const p = c.get('principal'), id = c.req.param('workspaceId'); requireWorkspaceRole(p, id, ['owner']); const b = await parseJson(c, z.object({ userId: z.string(), role: z.enum(['owner', 'coach', 'client']) })); await requireOrganization(c.env.DB,id); await validateRosterRole(c.env.DB,id,b.userId,b.role); const t = now(); await c.env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role,status,joined_at,created_at,updated_at,updated_by_user_id) VALUES (?,?,?,'active',?,?,?,?)`).bind(id, b.userId, b.role, t, t, t, p.userId).run(); await audit(c.env.DB, p.userId, 'workspace.member.added', 'workspace_member', b.userId, { workspaceId: id, subjectUserId: b.userId, metadata: { role: b.role } }); return data(c, { workspaceId: id, userId: b.userId, role: b.role }, 201); });
adminRoutes.patch('/workspaces/:workspaceId/members/:userId', async (c) => { const p = c.get('principal'), { workspaceId, userId } = c.req.param(); requireWorkspaceRole(p, workspaceId, ['owner']); const b = await parseJson(c, z.object({ role: z.enum(['owner', 'coach', 'client']).optional(), status: z.enum(['active', 'suspended']).optional() })); await requireOrganization(c.env.DB,workspaceId); if (b.role) await validateRosterRole(c.env.DB,workspaceId,userId,b.role); const current = await first<{ role: string; status: string }>(c.env.DB.prepare('SELECT role,status FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId, userId)); if (!current) throw new ApiError(404, 'not_found', 'Workspace member not found.'); if (current.role === 'client' && b.role && b.role !== 'client') throw new ApiError(409,'client_space_required','Client accounts keep their dedicated space. Suspend membership to disable access.'); await c.env.DB.prepare('UPDATE workspace_members SET role=?,status=?,updated_at=?,updated_by_user_id=? WHERE workspace_id=? AND user_id=?').bind(b.role ?? current.role, b.status ?? current.status, now(), p.userId, workspaceId, userId).run(); return data(c, { workspaceId, userId, role: b.role ?? current.role, status: b.status ?? current.status }); });
adminRoutes.delete('/workspaces/:workspaceId/members/:userId', async (c) => {
  const p = c.get('principal'), { workspaceId, userId } = c.req.param(); requireWorkspaceRole(p, workspaceId, ['owner']); await requireOrganization(c.env.DB,workspaceId); const member = await first<{ role: string }>(c.env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId, userId)); if (!member) throw new ApiError(404, 'not_found', 'Workspace member not found.'); if (member.role === 'owner') throw new ApiError(409, 'owner_removal', 'Transfer ownership before removing an owner.');
  if (member.role === 'client') {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE coach_client_relationships SET status='paused',updated_at=?,updated_by_user_id=? WHERE workspace_id=? AND client_user_id=? AND status='active'`).bind(now(),p.userId,workspaceId,userId),
      c.env.DB.prepare(`UPDATE workspace_members SET status='suspended',updated_at=?,updated_by_user_id=? WHERE workspace_id=? AND user_id=?`).bind(now(),p.userId,workspaceId,userId),
    ]);
    await audit(c.env.DB,p.userId,'client.suspended','user',userId,{workspaceId,subjectUserId:userId});
    return data(c,{suspended:true});
  }
  const programs = await all<{ id: string }>(c.env.DB.prepare('SELECT id FROM programs WHERE workspace_id=? AND owner_user_id=?').bind(workspaceId, userId)); if (member.role !== 'client' && programs.length) throw new ApiError(409, 'member_has_programs', 'Delete or transfer this member’s programs first.');
  const statements: D1PreparedStatement[] = [];
  for (const program of programs) statements.push(
    stampStatement(c.env.DB, 'strength_sets', 'workspace_id=? AND program_id=?', [workspaceId, program.id], p.userId), stampStatement(c.env.DB, 'cardio_sets', 'workspace_id=? AND program_id=?', [workspaceId, program.id], p.userId), stampStatement(c.env.DB, 'workout_exercises', 'workspace_id=? AND program_id=?', [workspaceId, program.id], p.userId), stampStatement(c.env.DB, 'workouts', 'workspace_id=? AND program_id=?', [workspaceId, program.id], p.userId), stampStatement(c.env.DB, 'mesocycles', 'workspace_id=? AND program_id=?', [workspaceId, program.id], p.userId), stampStatement(c.env.DB, 'programs', 'workspace_id=? AND id=?', [workspaceId, program.id], p.userId), deleteStatement(c.env.DB, 'programs', 'workspace_id=? AND id=?', [workspaceId, program.id]),
  );
  statements.push(stampStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=? AND (coach_user_id=? OR client_user_id=?)', [workspaceId, userId, userId], p.userId), stampStatement(c.env.DB, 'workspace_members', 'workspace_id=? AND user_id=?', [workspaceId, userId], p.userId), deleteStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=? AND (coach_user_id=? OR client_user_id=?)', [workspaceId, userId, userId]), deleteStatement(c.env.DB, 'workspace_members', 'workspace_id=? AND user_id=?', [workspaceId, userId]));
  await c.env.DB.batch(statements); await audit(c.env.DB, p.userId, 'workspace.member.removed', 'workspace_member', userId, { workspaceId, subjectUserId: userId }); return data(c, { removed: true });
});
