import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, audit, data, first, isPlatformAdmin, membership, newId, now, parseJson } from '../lib';
import { canManageRoster, requireStaff } from '../spaces';

export const clientRoutes = new Hono<AppEnv>();
interface ClientSpace { id: string; client_user_id: string; parent_workspace_id: string; }

async function clientSpace(c: Parameters<typeof data>[0], clientId: string) {
  const p=c.get('principal'); requireStaff(p);
  const row=await first<ClientSpace>(c.env.DB.prepare(`SELECT w.id,w.client_user_id,w.parent_workspace_id FROM workspaces w
    JOIN workspaces org ON org.id=w.parent_workspace_id JOIN workspace_members m ON m.workspace_id=org.id AND m.user_id=w.client_user_id
    JOIN users u ON u.id=m.user_id WHERE w.client_user_id=? AND w.kind='client' AND w.status='active'
    AND org.status='active' AND m.role='client' AND m.status='active' AND u.status='active'`).bind(clientId));
  if (!row) throw new ApiError(404,'not_found','Active client not found.');
  if (!canManageRoster(p,row.parent_workspace_id)) throw new ApiError(403,'forbidden','You cannot manage this client’s assignment.');
  return row;
}

clientRoutes.get('/clients',async c => {
  const p=c.get('principal');requireStaff(p);
  const rows=await all(c.env.DB.prepare(`SELECT w.id AS space_id,w.name AS space_name,w.parent_workspace_id AS organization_id,
    org.name AS organization_name,u.id AS client_user_id,u.display_name,u.email_display,
    r.id AS relationship_id,r.coach_user_id,coach.display_name AS coach_name,
    (SELECT COUNT(*) FROM programs p WHERE p.workspace_id=w.id) AS program_count,
    CASE WHEN ?=1 OR staff.role='owner' THEN 1 ELSE 0 END AS can_force_release,
    CASE WHEN ?=1 OR staff.role='owner' OR r.coach_user_id=? THEN 1 ELSE 0 END AS can_open
    FROM workspaces w JOIN workspaces org ON org.id=w.parent_workspace_id
    JOIN users u ON u.id=w.client_user_id JOIN workspace_members cm ON cm.workspace_id=org.id AND cm.user_id=u.id
    LEFT JOIN workspace_members staff ON staff.workspace_id=org.id AND staff.user_id=? AND staff.status='active'
    LEFT JOIN coach_client_relationships r ON r.client_user_id=u.id AND r.workspace_id=org.id AND r.status='active'
    LEFT JOIN users coach ON coach.id=r.coach_user_id
    WHERE w.kind='client' AND w.status='active' AND org.status='active' AND cm.role='client' AND cm.status='active'
      AND u.status='active' AND (?=1 OR staff.role IN ('owner','coach')) ORDER BY u.display_name,u.id
  `).bind(isPlatformAdmin(p)?1:0,isPlatformAdmin(p)?1:0,p.userId,p.userId,isPlatformAdmin(p)?1:0));
  return data(c,rows);
});

clientRoutes.post('/clients/:clientId/claim',async c => {
  const p=c.get('principal'),space=await clientSpace(c,c.req.param('clientId'));
  const body=await parseJson(c,z.object({coachUserId:z.string().optional()}));
  const coach=body.coachUserId??p.userId;
  const canAssign=isPlatformAdmin(p)||membership(p,space.parent_workspace_id)?.role==='owner';
  if (coach!==p.userId&&!canAssign) throw new ApiError(403,'forbidden','Coaches can only claim clients for themselves.');
  const valid=await first(c.env.DB.prepare(`SELECT 1 FROM workspace_members m JOIN users u ON u.id=m.user_id
    WHERE m.workspace_id=? AND m.user_id=? AND m.role IN ('coach','owner') AND m.status='active' AND u.status='active'`).bind(space.parent_workspace_id,coach));
  if (!valid) throw new ApiError(400,'invalid_coach','Choose an active coach or owner in this organization.');
  const id=newId(),t=now();
  // A global partial unique index makes simultaneous claims safe.
  const results=await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE coach_client_relationships SET updated_at=?,updated_by_user_id=?
      WHERE workspace_id=? AND coach_user_id=? AND client_user_id=? AND status='paused'`).bind(t,p.userId,space.parent_workspace_id,coach,space.client_user_id),
    c.env.DB.prepare(`DELETE FROM coach_client_relationships
      WHERE workspace_id=? AND coach_user_id=? AND client_user_id=? AND status='paused'`).bind(space.parent_workspace_id,coach,space.client_user_id),
    c.env.DB.prepare(`INSERT INTO coach_client_relationships (id,workspace_id,coach_user_id,client_user_id,status,created_at,updated_at,updated_by_user_id)
      VALUES (?,?,?,?,'active',?,?,?) ON CONFLICT DO NOTHING`).bind(id,space.parent_workspace_id,coach,space.client_user_id,t,t,p.userId),
  ]);
  // Each claim gets a fresh ID, so a stale release cannot remove a new assignment.
  if (!results.at(-1)?.meta.changes) throw new ApiError(409,'client_assigned','This client has already been claimed. Refresh the directory.');
  await audit(c.env.DB,p.userId,'client.claimed','client',space.client_user_id,{workspaceId:space.id,subjectUserId:coach});
  return data(c,{claimed:true},201);
});

clientRoutes.post('/clients/:clientId/release',async c => {
  const p=c.get('principal'),space=await clientSpace(c,c.req.param('clientId'));
  const body=await parseJson(c,z.object({relationshipId:z.string().min(1)}));
  const force=isPlatformAdmin(p)||membership(p,space.parent_workspace_id)?.role==='owner';
  const result=await c.env.DB.prepare(`UPDATE coach_client_relationships SET status='paused',updated_at=?,updated_by_user_id=?
    WHERE id=? AND client_user_id=? AND workspace_id=? AND status='active' AND (?=1 OR coach_user_id=?)`).bind(now(),p.userId,body.relationshipId,space.client_user_id,space.parent_workspace_id,force?1:0,p.userId).run();
  if (!result.meta.changes) throw new ApiError(force?409:403,'release_denied',force?'The assignment changed. Refresh the directory.':'You can only release your own clients.');
  await audit(c.env.DB,p.userId,'client.released','client',space.client_user_id,{workspaceId:space.id,metadata:{relationshipId:body.relationshipId}});
  return data(c,{released:true});
});
