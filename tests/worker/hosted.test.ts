import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import application from '../../worker/index';
import { createHostedWorker } from '../../worker/hosted';
import { principalFromAccess } from '../../worker/auth';
import hostedSeed from '../../cloudflare/hosted-seed.sql?raw';
import type { Bindings } from '../../worker/types';

const hostedEnv: Bindings = { ...env, APP_ENV: 'production', LOCAL_AUTH_ENABLED: 'true' };
const identity = { getIdentity: async () => ({ email: 'Luke.Edwards20@gmail.com' }) };
function context(access?: object) {
  const ctx = createExecutionContext();
  if (access) Object.defineProperty(ctx, 'access', { value: access });
  return ctx;
}
const hosted = createHostedWorker({ '/index.html': { body: btoa('<html>LiftLog</html>'), contentType: 'text/html', etag: '"test"' } });
const call = (path: string, ctx = context(), init?: RequestInit) => hosted.fetch!(new Request(`https://liftlog.test${path}`, init), hostedEnv, ctx);
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.exec(hostedSeed.replace(/\n/g, ' '));
});

describe('hosted Access boundary', () => {
  it('rejects missing Access, forged email headers and local cookies on the frontend and API', async () => {
    for (const path of ['/', '/api/session', '/programs/test']) {
      const response = await call(path, context(), { headers: { Cookie: 'liftlog_local_user=user-owner', 'Cf-Access-Authenticated-User-Email': 'luke.edwards20@gmail.com' } });
      expect(response.status).toBe(403);
    }
    const response = await application.fetch(new Request('https://liftlog.test/api/session', { headers: { Cookie: 'liftlog_local_user=user-owner' } }), hostedEnv, context());
    expect(response.status).toBe(401);
  });
  it('loads the owner principal only from runtime identity', async () => {
    const response = await call('/api/session', context(identity));
    expect(response.status).toBe(200);
    const { data } = await response.json() as { data: { userId: string; platformRoles: string[]; availableWorkspaces: unknown[] } };
    expect(data.userId).toBe('user-owner'); expect(data.platformRoles).toEqual(['admin']); expect(data.availableWorkspaces).toHaveLength(1);
  });
  it('rejects invalid, unknown, failed, and disabled identities', async () => {
    for (const access of [{ getIdentity: async () => ({ email: 'unknown@example.test' }) }, { getIdentity: async () => ({}) }, { getIdentity: async () => { throw new Error('unavailable'); } }]) {
      await expect(principalFromAccess(env.DB, { access })).rejects.toBeDefined();
    }
    await env.DB.prepare("UPDATE users SET status='disabled' WHERE id='user-owner'").run();
    try { await expect(principalFromAccess(env.DB, { access: identity })).rejects.toBeDefined(); }
    finally { await env.DB.prepare("UPDATE users SET status='active' WHERE id='user-owner'").run(); }
  });
  it('disables local auth and test fixtures even if the local flag is accidentally enabled', async () => {
    for (const [path, method] of [['/api/local-auth/users', 'GET'], ['/api/local-auth/session', 'POST'], ['/api/testing/fixtures', 'POST']]) {
      expect((await call(path!, context(identity), { method })).status).toBe(404);
    }
  });
  it('serves authenticated SPA routes, HEAD and conditional requests; preserves API and asset 404s', async () => {
    expect(await (await call('/programs/test', context(identity))).text()).toContain('LiftLog');
    expect(await (await call('/', context(identity), { method: 'HEAD' })).text()).toBe('');
    expect((await call('/', context(identity), { headers: { 'If-None-Match': '"test"' } })).status).toBe(304);
    expect((await call('/missing.js', context(identity))).status).toBe(404);
    expect((await call('/api/missing', context(identity))).status).toBe(404);
    expect((await call('/', context(identity), { method: 'POST' })).status).toBe(405);
  });
  it('rejects cross-origin writes', async () => {
    expect((await call('/api/workspaces', context(identity), { method: 'POST', headers: { Origin: 'https://attacker.test' } })).status).toBe(403);
  });
});
