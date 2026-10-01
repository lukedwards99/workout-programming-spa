import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import type { AppEnv, AuthPrincipal, WorkspaceAccess } from './types';
import { all, ApiError, first } from './lib';
import { accessibleSpaces } from './spaces';
import { resolveValidatedProviderIdentity } from './provider-auth';

export const LOCAL_USER_COOKIE = 'liftlog_local_user';
export const TEST_USER_COOKIE = 'liftlog_test_session';

async function principalFromIdentity(db: D1Database, provider: string, providerSubject: string, simulatedUserId?: string): Promise<AuthPrincipal | null> {
  const identity = await first<{
    user_id: string;
    display_name: string;
    email_normalized: string;
    status: string;
    provider: string;
    provider_subject: string;
  }>(simulatedUserId ? db.prepare(`SELECT id AS user_id, display_name, email_normalized, status,
    'test-wrapper' AS provider, id AS provider_subject FROM users WHERE id = ?`).bind(simulatedUserId) : db.prepare(
    `SELECT u.id AS user_id, u.display_name, u.email_normalized, u.status,
            ai.provider, ai.provider_subject
     FROM users u
     JOIN auth_identities ai ON ai.user_id = u.id
     WHERE ai.provider = ? AND ai.provider_subject = ?`,
  ).bind(provider, providerSubject));
  if (!identity || (identity.status !== 'active' && !(simulatedUserId && identity.status === 'invited'))) return null;
  const userId = identity.user_id;

  const platformRoles = await all<{ role: string }>(db.prepare(
    'SELECT role FROM platform_user_roles WHERE user_id = ? ORDER BY role',
  ).bind(userId));
  const isAdmin = platformRoles.some((item) => item.role === 'admin');
  const available = await accessibleSpaces(db, userId, isAdmin);
  const memberships = available.filter(item => item.role);

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
      kind: item.kind,
      clientUserId: item.client_user_id,
      personalOwnerUserId: item.personal_owner_user_id,
      parentWorkspaceId: item.parent_workspace_id,
      role: item.role,
      status: item.status,
    })),
    availableWorkspaces: available.map((item): WorkspaceAccess => ({
      workspaceId: item.workspace_id,
      workspaceName: item.workspace_name,
      kind: item.kind,
      clientUserId: item.client_user_id,
      personalOwnerUserId: item.personal_owner_user_id,
      parentWorkspaceId: item.parent_workspace_id,
      role: isAdmin ? 'admin' : item.role,
      status: item.status,
      isMember: Boolean(item.is_member),
    })),
  };
}

export function loadPrincipal(db: D1Database, userId: string): Promise<AuthPrincipal | null> {
  return principalFromIdentity(db, 'local', userId);
}

export function loadPrincipalForIdentity(db: D1Database, provider: string, providerSubject: string): Promise<AuthPrincipal | null> {
  return principalFromIdentity(db, provider, providerSubject);
}

export function loadTestPrincipal(db: D1Database, userId: string) {
  return principalFromIdentity(db, '', '', userId);
}

export function isLocalAuth(env: AppEnv['Bindings']) {
  return ['local', 'test'].includes(env.APP_ENV) && env.LOCAL_AUTH_ENABLED === 'true';
}

export function canSwitchIdentity(env: AppEnv['Bindings'], actor: AuthPrincipal) {
  return isLocalAuth(env) || (env.APP_ENV === 'dev' && env.DEV_IDENTITY_SWITCH_ENABLED === 'true'
    && actor.verifiedEmail === env.DEV_IDENTITY_SWITCH_EMAIL && actor.platformRoles.includes('admin'));
}

export async function authenticatedPrincipal(c: Context<AppEnv>): Promise<AuthPrincipal> {
  if (!isLocalAuth(c.env)) return principalFromAccess(c.env.DB, c.executionCtx);
  const userId = getCookie(c, LOCAL_USER_COOKIE);
  const principal = userId ? await loadPrincipal(c.env.DB, userId) : null;
  if (!principal) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  return principal;
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const actor = await authenticatedPrincipal(c);
  let principal = actor;
  const canSwitch = canSwitchIdentity(c.env, actor);
  const token = getCookie(c, TEST_USER_COOKIE);
  if (canSwitch && token) {
    const session = await first<{ subject_user_id: string }>(c.env.DB.prepare(
      'SELECT subject_user_id FROM test_identity_sessions WHERE token_hash = ? AND actor_user_id = ? AND expires_at > ?',
    ).bind(await hashSessionToken(token), actor.userId, new Date().toISOString()));
    const simulated = session ? await loadTestPrincipal(c.env.DB, session.subject_user_id) : null;
    if (!simulated) {
      deleteCookie(c, TEST_USER_COOKIE, { path: '/' });
      throw new ApiError(401, 'test_session_expired', 'Your test session ended. Sign in again to choose an account.');
    }
    principal = simulated;
  }
  principal.testing = { canSwitch, authenticatedEmail: actor.verifiedEmail, isImpersonating: principal.userId !== actor.userId };
  c.set('principal', principal);
  await next();
};

// Only the runtime-authenticated invocation is trusted, never request headers.
export async function principalFromAccess(db: D1Database, context: object): Promise<AuthPrincipal> {
  const access = (context as { access?: { getIdentity(): Promise<{ email?: string } | undefined> } }).access;
  let identity;
  try { identity = await access?.getIdentity(); } catch { /* Fail closed. */ }
  const email = typeof identity?.email === 'string' ? identity.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new ApiError(401, 'identity_required', 'Sign in through Cloudflare Access to continue.');
  }
  return resolveValidatedProviderIdentity(db, {
    provider: 'cloudflare-access', providerSubject: email, verifiedEmail: email,
  });
}
