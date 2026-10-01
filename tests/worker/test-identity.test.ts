import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import application from '../../worker/index';
import hostedSeed from '../../cloudflare/hosted-seed.sql?raw';
import devPersonas from '../../cloudflare/dev-personas.sql?raw';
import type { AuthPrincipal, Bindings } from '../../worker/types';

const dev: Bindings = { ...env, APP_ENV: 'dev', LOCAL_AUTH_ENABLED: 'false', DEV_IDENTITY_SWITCH_ENABLED: 'true', DEV_IDENTITY_SWITCH_EMAIL: 'luke.edwards20@gmail.com' };
function context(email?: string) {
  const ctx = createExecutionContext();
  if (email) Object.defineProperty(ctx, 'access', { value: { getIdentity: async () => ({ email }) } });
  return ctx;
}
function call(path: string, init?: RequestInit, bindings = dev, email: string | null = 'luke.edwards20@gmail.com') {
  return application.fetch(new Request(`https://liftlog.test/api${path}`, init), bindings, context(email ?? undefined));
}
const body = (value: unknown, cookie?: string): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(value) });
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.match(/liftlog_test_session=[^;]+/)![0];
const dataOf = async <T,>(r: Response) => (await r.json() as { data: T }).data;
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.exec(hostedSeed.replace(/\n/g, ' '));
  await env.DB.exec(devPersonas.replace(/^--.*$/gm, '').replace(/\n/g, ' '));
});

describe('temporary test identity wrapper', () => {
  it('requires the configured real Access administrator and cannot run in production', async () => {
    expect((await call('/test-auth/users', undefined, dev, null)).status).toBe(401);
    expect((await call('/test-auth/users', undefined, { ...dev, DEV_IDENTITY_SWITCH_ENABLED: 'false' })).status).toBe(404);
    expect((await call('/test-auth/users', undefined, dev, 'coach@liftlog.test')).status).toBe(404);
    for (const [path, init] of [['/test-auth/users', undefined], ['/test-auth/session', body({ userId: 'user-dev-athlete' })]] as const) {
      expect((await call(path, init, { ...dev, APP_ENV: 'production' })).status).toBe(404);
    }
    expect((await call('/test-auth/users', undefined, { ...dev, DEV_IDENTITY_SWITCH_EMAIL: 'other@example.test' })).status).toBe(404);
  });
  it('issues a secure opaque session and applies the selected user to every protected endpoint', async () => {
    const response = await call('/test-auth/session', body({ userId: 'user-dev-athlete' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(response.headers.get('set-cookie')).toMatch(/Secure/);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Strict/);
    const cookie = cookieOf(response);
    expect(cookie).not.toContain('user-dev-athlete');
    const principal = await dataOf<AuthPrincipal>(await call('/session', { headers: { Cookie: cookie } }));
    expect(principal.userId).toBe('user-dev-athlete');
    expect(principal.testing).toMatchObject({ authenticatedEmail: 'luke.edwards20@gmail.com', isImpersonating: true });
    expect(principal.platformRoles).toEqual([]);
    expect((await call('/admin/users', { headers: { Cookie: cookie } })).status).toBe(403);
    expect((await call('/workspaces/workspace-owner/programs', body({ name: 'Forbidden plan' }, cookie))).status).toBe(403);
    expect((await call('/test-auth/users', { headers: { Cookie: cookie } })).status).toBe(200);
    const audit = await env.DB.prepare("SELECT actor_user_id,subject_user_id FROM audit_events WHERE action='session.test.started' AND subject_user_id='user-dev-athlete'").first();
    expect(audit).toMatchObject({ actor_user_id: 'user-owner', subject_user_id: 'user-dev-athlete' });
  });
  it('isolates program visibility and plan/execution permissions across test emails', async () => {
    const p = await dataOf<{ id: string }>(await call('/workspaces/client-space-user-dev-athlete/programs', body({ name: 'Athlete program', ownerUserId: 'user-dev-athlete' })));
    const own = await dataOf<{ id: string }>(await call('/workspaces/workspace-owner/programs', body({ name: 'Private owner program' })));
    const cookie = cookieOf(await call('/test-auth/session', body({ userId: 'user-dev-athlete' })));
    const programs = await dataOf<Array<{ id: string }>>(await call('/workspaces/client-space-user-dev-athlete/programs', { headers: { Cookie: cookie } }));
    expect(programs.map((x) => x.id)).toContain(p.id);
    expect(programs.map((x) => x.id)).not.toContain(own.id);
    expect((await call(`/workspaces/workspace-owner/programs/${own.id}`, { headers: { Cookie: cookie } })).status).toBe(403);
    const coach = cookieOf(await call('/test-auth/session', body({ userId: 'user-dev-coach' }, cookie)));
    expect((await call(`/workspaces/client-space-user-dev-athlete/programs/${p.id}`, { headers: { Cookie: coach } })).status).toBe(200);
    expect((await call(`/workspaces/workspace-owner/programs/${own.id}`, { headers: { Cookie: coach } })).status).toBe(403);
  });
  it('rejects forged, expired and disabled subjects without reverting writes to the admin', async () => {
    expect((await call('/session', { headers: { Cookie: 'liftlog_test_session=user-dev-athlete' } })).status).toBe(401);
    const cookie = cookieOf(await call('/test-auth/session', body({ userId: 'user-dev-athlete' })));
    await env.DB.prepare("UPDATE test_identity_sessions SET expires_at='2000-01-01' WHERE subject_user_id='user-dev-athlete'").run();
    expect((await call('/workspaces', body({ name: 'Cannot fall back to owner' }, cookie))).status).toBe(401);
    const next = cookieOf(await call('/test-auth/session', body({ userId: 'user-dev-athlete' })));
    await env.DB.prepare("UPDATE users SET status='disabled' WHERE id='user-dev-athlete'").run();
    try {
      expect((await call('/session', { headers: { Cookie: next } })).status).toBe(401);
      expect((await call('/test-auth/session', body({ userId: 'user-dev-athlete' }))).status).toBe(400);
    } finally { await env.DB.prepare("UPDATE users SET status='active' WHERE id='user-dev-athlete'").run(); }
  });
  it('binds the cookie to the real account and restores real identity on exit', async () => {
    const cookie = cookieOf(await call('/test-auth/session', body({ userId: 'user-dev-coach' })));
    expect((await call('/session', { headers: { Cookie: cookie } }, dev, 'unknown@example.test')).status).toBe(401);
    const exit = await call('/test-auth/session', { method: 'DELETE', headers: { Cookie: cookie } });
    expect(exit.status).toBe(200);
    expect(exit.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('/session', { headers: { Cookie: cookie } })).status).toBe(401);
    const principal = await dataOf<AuthPrincipal>(await call('/session'));
    expect(principal.userId).toBe('user-owner');
    const production = await dataOf<AuthPrincipal>(await call('/session', { headers: { Cookie: cookie } }, { ...dev, APP_ENV: 'production' }));
    expect(production.userId).toBe('user-owner');
    expect(production.testing?.canSwitch).toBe(false);
  });
});
