import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv, AuthPrincipal, WorkspaceMembership } from './types';
import { all, ApiError, first } from './lib';

export const LOCAL_USER_COOKIE = 'liftlog_local_user';

async function principalFromIdentity(db: D1Database, provider: string, providerSubject: string): Promise<AuthPrincipal | null> {
  const identity = await first<{
    user_id: string;
    display_name: string;
    email_normalized: string;
    status: string;
    provider: string;
    provider_subject: string;
  }>(db.prepare(
    `SELECT u.id AS user_id, u.display_name, u.email_normalized, u.status,
            ai.provider, ai.provider_subject
     FROM users u
     JOIN auth_identities ai ON ai.user_id = u.id
     WHERE ai.provider = ? AND ai.provider_subject = ?`,
  ).bind(provider, providerSubject));
  if (!identity || identity.status !== 'active') return null;
  const userId = identity.user_id;

  const platformRoles = await all<{ role: string }>(db.prepare(
    'SELECT role FROM platform_user_roles WHERE user_id = ? ORDER BY role',
  ).bind(userId));
  const memberships = await all<{
    workspace_id: string;
    workspace_name: string;
    role: WorkspaceMembership['role'];
    status: WorkspaceMembership['status'];
  }>(db.prepare(
    `SELECT wm.workspace_id, w.name AS workspace_name, wm.role, wm.status
     FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = ? ORDER BY w.name`,
  ).bind(userId));

  return {
    userId: identity.user_id,
    displayName: identity.display_name,
    verifiedEmail: identity.email_normalized,
    provider: identity.provider,
    providerSubject: identity.provider_subject,
    platformRoles: platformRoles.map((item) => item.role),
    memberships: memberships.map((item) => ({
      workspaceId: item.workspace_id,
      workspaceName: item.workspace_name,
      role: item.role,
      status: item.status,
    })),
  };
}

export function loadPrincipal(db: D1Database, userId: string): Promise<AuthPrincipal | null> {
  return principalFromIdentity(db, 'local', userId);
}

export function loadPrincipalForIdentity(db: D1Database, provider: string, providerSubject: string): Promise<AuthPrincipal | null> {
  return principalFromIdentity(db, provider, providerSubject);
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = getCookie(c, LOCAL_USER_COOKIE);
  if (!userId) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  const principal = await loadPrincipal(c.env.DB, userId);
  if (!principal) throw new ApiError(401, 'unauthenticated', 'The local session is no longer valid.');
  c.set('principal', principal);
  await next();
};
