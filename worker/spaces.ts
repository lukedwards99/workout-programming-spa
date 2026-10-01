import { all, ApiError, isPlatformAdmin, membership } from './lib';
import type { AuthPrincipal, WorkspaceMembership } from './types';

export interface SpaceRow {
  workspace_id: string;
  workspace_name: string;
  role: WorkspaceMembership['role'];
  status: WorkspaceMembership['status'];
  kind: 'organization' | 'personal' | 'client';
  client_user_id: string | null;
  personal_owner_user_id: string | null;
  parent_workspace_id: string | null;
  is_member: number;
}

// Derived access is rebuilt on every request. Releasing a client never leaves a
// stale coach membership behind. Roster membership alone cannot open client data.
export async function accessibleSpaces(db: D1Database, userId: string, admin: boolean) {
  return all<SpaceRow>(db.prepare(`
    SELECT w.id AS workspace_id,w.name AS workspace_name,w.kind,w.client_user_id,
      w.personal_owner_user_id,w.parent_workspace_id,
      CASE WHEN w.kind='client' THEN
        CASE WHEN w.client_user_id=? THEN 'client'
          WHEN EXISTS(SELECT 1 FROM workspace_members o WHERE o.workspace_id=w.parent_workspace_id AND o.user_id=? AND o.role='owner' AND o.status='active') THEN 'owner'
          ELSE 'coach' END
        ELSE m.role END AS role,
      'active' AS status,CASE WHEN m.user_id IS NULL THEN 0 ELSE 1 END AS is_member
    FROM workspaces w LEFT JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=? AND m.status='active'
    WHERE w.status='active' AND (?=1 OR
      (w.kind<>'client' AND m.user_id IS NOT NULL AND m.role<>'client') OR
      (w.kind='client' AND EXISTS(SELECT 1 FROM workspaces org JOIN workspace_members cm ON cm.workspace_id=org.id
        JOIN users cu ON cu.id=cm.user_id WHERE org.id=w.parent_workspace_id AND org.status='active'
        AND cm.user_id=w.client_user_id AND cm.role='client' AND cm.status='active' AND cu.status='active')
        AND (w.client_user_id=? OR EXISTS(SELECT 1 FROM workspace_members o WHERE o.workspace_id=w.parent_workspace_id AND o.user_id=? AND o.role='owner' AND o.status='active')
          OR EXISTS(SELECT 1 FROM coach_client_relationships r JOIN workspace_members coach ON coach.workspace_id=r.workspace_id AND coach.user_id=r.coach_user_id
            WHERE r.client_user_id=w.client_user_id AND r.workspace_id=w.parent_workspace_id AND r.coach_user_id=? AND r.status='active'
            AND coach.role IN ('coach','owner') AND coach.status='active'))))
    ORDER BY CASE w.kind WHEN 'organization' THEN 0 WHEN 'personal' THEN 1 ELSE 2 END,w.name
  `).bind(userId,userId,userId,admin ? 1 : 0,userId,userId,userId));
}

export function requireStaff(principal: AuthPrincipal) {
  if (!isPlatformAdmin(principal) && !principal.memberships.some(m => m.status==='active' && m.kind==='organization' && ['owner','coach'].includes(m.role))) {
    throw new ApiError(403,'forbidden','Client assignments are available to coaches, owners, and administrators.');
  }
}

export function canManageRoster(principal: AuthPrincipal, organizationId: string) {
  const member=membership(principal,organizationId);
  return isPlatformAdmin(principal) || (member?.kind==='organization' && ['owner','coach'].includes(member.role));
}
