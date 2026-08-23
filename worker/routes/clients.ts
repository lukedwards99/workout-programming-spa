import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, data, deleteStatement, first, isPlatformAdmin, newId, now, parseJson, requireWorkspaceRole, stampStatement } from '../lib';

export const clientRoutes = new Hono<AppEnv>();

clientRoutes.get('/workspaces/:workspaceId/clients', async (c) => {
  const principal = c.get('principal'), workspaceId = c.req.param('workspaceId'); const access = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const rows = await all(c.env.DB.prepare(`SELECT r.*,u.display_name,u.email_display,wm.status AS membership_status,(SELECT COUNT(*) FROM programs p WHERE p.workspace_id=r.workspace_id AND p.owner_user_id=r.client_user_id) AS program_count FROM coach_client_relationships r JOIN users u ON u.id=r.client_user_id JOIN workspace_members wm ON wm.workspace_id=r.workspace_id AND wm.user_id=r.client_user_id WHERE r.workspace_id=? AND (?=1 OR ?='owner' OR r.coach_user_id=?) ORDER BY u.display_name`).bind(workspaceId, isPlatformAdmin(principal) ? 1 : 0, access.role, principal.userId));
  return data(c, rows);
});

clientRoutes.post('/workspaces/:workspaceId/clients', async (c) => {
  const principal = c.get('principal'), workspaceId = c.req.param('workspaceId'); const access = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({ clientUserId: z.string(), coachUserId: z.string().optional() })); const coach = body.coachUserId ?? principal.userId;
  if (access.role === 'coach' && !isPlatformAdmin(principal) && coach !== principal.userId) throw new ApiError(403, 'forbidden', 'A coach can only create their own relationship.');
  const valid = await first(c.env.DB.prepare(`SELECT 1 FROM workspace_members WHERE workspace_id=? AND user_id=? AND role='client' AND status='active'`).bind(workspaceId, body.clientUserId)); if (!valid) throw new ApiError(400, 'invalid_client', 'Choose an active client in this workspace.');
  const id = newId(), t = now(); await c.env.DB.prepare(`INSERT INTO coach_client_relationships (id,workspace_id,coach_user_id,client_user_id,status,created_at,updated_at,updated_by_user_id) VALUES (?,?,?,?,'active',?,?,?)`).bind(id, workspaceId, coach, body.clientUserId, t, t, principal.userId).run(); return data(c, await first(c.env.DB.prepare('SELECT * FROM coach_client_relationships WHERE id=?').bind(id)), 201);
});

clientRoutes.delete('/workspaces/:workspaceId/clients/:relationshipId', async (c) => {
  const principal = c.get('principal'), { workspaceId, relationshipId } = c.req.param(); const access = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']); const row = await first<{ coach_user_id: string }>(c.env.DB.prepare('SELECT coach_user_id FROM coach_client_relationships WHERE workspace_id=? AND id=?').bind(workspaceId, relationshipId)); if (!row) throw new ApiError(404, 'not_found', 'Coach/client relationship not found.'); if (!isPlatformAdmin(principal) && access.role !== 'owner' && row.coach_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'You cannot remove another coach’s relationship.'); await c.env.DB.batch([stampStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=? AND id=?', [workspaceId, relationshipId], principal.userId), deleteStatement(c.env.DB, 'coach_client_relationships', 'workspace_id=? AND id=?', [workspaceId, relationshipId])]); return data(c, { deleted: true });
});
